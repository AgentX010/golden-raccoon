#!/usr/bin/env node

/**
 * Offline Artifact Provenance Verifier
 *
 * Recomputes input and artifact hashes, validates the manifest schema, and
 * detects source / settings / tool / manifest / artifact tampering.
 *
 * Usage:
 *   node scripts/verify-artifact-provenance.mjs --help
 *   node scripts/verify-artifact-provenance.mjs [--strict] [manifest-path]
 *   node scripts/verify-artifact-provenance.mjs --self-test
 */

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");

const EXPECTED = {
  solidity: "0.8.24",
  evmVersion: "paris",
  optimizerRuns: 200,
  viaIR: true,
  sorobanSdk: "=26.0.1",
  wasmTarget: "wasm32v1-none",
};

function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function hashFile(absPath) {
  if (!existsSync(absPath)) return null;
  return sha256Buffer(readFileSync(absPath));
}

function normalizeBytecode(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]*$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

function recomputeEvm(absPath) {
  if (!existsSync(absPath)) {
    return {
      creationBytecodeSha256: null,
      deployedBytecodeSha256: null,
      metadataSha256: null,
      abiSha256: null,
    };
  }
  const artifact = JSON.parse(readFileSync(absPath, "utf8"));
  const creation = normalizeBytecode(artifact.bytecode);
  const deployed = normalizeBytecode(artifact.deployedBytecode);
  const metadata =
    typeof artifact.metadata === "string"
      ? artifact.metadata
      : artifact.metadata
        ? JSON.stringify(artifact.metadata)
        : null;
  return {
    creationBytecodeSha256: creation ? sha256Buffer(creation) : null,
    deployedBytecodeSha256: deployed ? sha256Buffer(deployed) : null,
    metadataSha256: metadata ? sha256Buffer(Buffer.from(metadata, "utf8")) : null,
    abiSha256: sha256Buffer(Buffer.from(JSON.stringify(artifact.abi ?? []), "utf8")),
  };
}

function validateSchema(manifest) {
  const errors = [];
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (manifest.kind !== "contract-artifact-provenance") {
    errors.push('kind must be "contract-artifact-provenance"');
  }
  if (typeof manifest.timestamp !== "string" || !manifest.timestamp) {
    errors.push("timestamp is required");
  }
  if (typeof manifest.commit !== "string" || !manifest.commit) {
    errors.push("commit is required");
  }
  if (typeof manifest.isDirty !== "boolean") errors.push("isDirty must be boolean");
  if (typeof manifest.releaseApproved !== "boolean") {
    errors.push("releaseApproved must be boolean");
  }
  if (!manifest.tools || typeof manifest.tools !== "object") {
    errors.push("tools object is required");
  }
  if (!Array.isArray(manifest.inputs)) errors.push("inputs must be an array");
  if (!Array.isArray(manifest.artifacts)) errors.push("artifacts must be an array");

  const blob = JSON.stringify(manifest);
  if (/\/Users\/|\/home\/|[A-Za-z]:\\/.test(blob)) {
    errors.push("manifest must not contain absolute user paths");
  }
  if (/-----BEGIN[ A-Z]*PRIVATE KEY-----|(api[_-]?key|password)\s*[:=]/i.test(blob)) {
    errors.push("manifest must not contain secrets");
  }
  if (/https?:\/\/[^/\s]+:[^/@\s]+@/i.test(blob)) {
    errors.push("manifest must not contain credential-bearing URLs");
  }

  return errors;
}

function validateClaimedTools(manifest) {
  const errors = [];
  const tools = manifest.tools || {};
  if (tools.solidity !== EXPECTED.solidity) {
    errors.push(`tools.solidity expected ${EXPECTED.solidity}, got ${tools.solidity}`);
  }
  if (tools.evmVersion !== EXPECTED.evmVersion) {
    errors.push(`tools.evmVersion expected ${EXPECTED.evmVersion}, got ${tools.evmVersion}`);
  }
  if (tools.viaIR !== EXPECTED.viaIR) {
    errors.push(`tools.viaIR expected ${EXPECTED.viaIR}, got ${tools.viaIR}`);
  }
  if (tools.optimizer?.runs !== EXPECTED.optimizerRuns) {
    errors.push(`tools.optimizer.runs expected ${EXPECTED.optimizerRuns}`);
  }
  if (tools.sorobanSdk !== EXPECTED.sorobanSdk) {
    errors.push(`tools.sorobanSdk expected ${EXPECTED.sorobanSdk}, got ${tools.sorobanSdk}`);
  }
  if (tools.wasmTarget !== EXPECTED.wasmTarget) {
    errors.push(`tools.wasmTarget expected ${EXPECTED.wasmTarget}, got ${tools.wasmTarget}`);
  }
  return errors;
}

function validateLiveSettings() {
  const errors = [];
  const hardhat = readFileSync(join(ROOT, "backend/contracts/hardhat.config.ts"), "utf8");
  if (!/evmVersion:\s*["']paris["']/.test(hardhat)) {
    errors.push('live hardhat.config.ts does not pin evmVersion "paris"');
  }
  if (!hardhat.includes('version: "0.8.24"') && !hardhat.includes("version: '0.8.24'")) {
    errors.push("live hardhat.config.ts does not pin Solidity 0.8.24");
  }
  const cargo = readFileSync(join(ROOT, "soroban/Cargo.toml"), "utf8");
  if (!cargo.includes('soroban-sdk = "=26.0.1"')) {
    errors.push("live soroban/Cargo.toml does not pin soroban-sdk =26.0.1");
  }
  return errors;
}

export function verifyProvenanceManifest(manifestPath, options = {}) {
  const strict = options.strict ?? false;
  const root = options.root ?? ROOT;
  const targetPath = resolve(root, manifestPath);

  if (!existsSync(targetPath)) {
    return { valid: false, reason: `Manifest not found at ${manifestPath}`, details: [] };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(targetPath, "utf8"));
  } catch (err) {
    return { valid: false, reason: `Invalid JSON manifest: ${err.message}`, details: [] };
  }

  const schemaErrors = validateSchema(manifest);
  if (schemaErrors.length > 0) {
    return {
      valid: false,
      reason: `Manifest schema invalid: ${schemaErrors.join("; ")}`,
      details: schemaErrors.map((message) => ({ name: "schema", matches: false, detail: message })),
    };
  }

  const toolErrors = validateClaimedTools(manifest);
  const liveErrors = options.skipLiveSettings ? [] : validateLiveSettings();
  const details = [];
  let allMatched = toolErrors.length === 0 && liveErrors.length === 0;

  for (const message of toolErrors) {
    details.push({ name: "tools", matches: false, detail: message });
  }
  for (const message of liveErrors) {
    details.push({ name: "settings", matches: false, detail: message });
  }

  if (strict) {
    if (manifest.isDirty) {
      return {
        valid: false,
        reason: "Manifest rejected under --strict: dirty working tree at freeze time",
        details,
      };
    }
    if (!manifest.releaseApproved) {
      return {
        valid: false,
        reason: "Manifest rejected under --strict: releaseApproved is false",
        details,
      };
    }
  }

  for (const input of manifest.inputs) {
    const actual = hashFile(join(root, input.path));
    // null/null is allowed for optional missing inputs on non-release manifests.
    const matches = actual === input.sha256;
    if (!matches) allMatched = false;
    details.push({
      name: `input:${input.name || input.path}`,
      path: input.path,
      expected: input.sha256,
      actual,
      matches,
    });
  }

  for (const artifact of manifest.artifacts) {
    const abs = join(root, artifact.path);
    if (artifact.kind === "evm-bytecode") {
      const actual = recomputeEvm(abs);
      const fields = [
        "creationBytecodeSha256",
        "deployedBytecodeSha256",
        "metadataSha256",
        "abiSha256",
      ];
      for (const field of fields) {
        if (artifact[field] == null) continue;
        const matches = actual[field] !== null && actual[field] === artifact[field];
        if (!matches) allMatched = false;
        details.push({
          name: `${artifact.name}:${field}`,
          path: artifact.path,
          expected: artifact[field],
          actual: actual[field],
          matches,
        });
      }
      continue;
    }

    if (artifact.kind === "soroban-wasm") {
      const actual = hashFile(abs);
      // null/null means both sides record a missing artifact (non-release freeze).
      const matches = actual === artifact.sha256;
      if (!matches) allMatched = false;
      details.push({
        name: artifact.name,
        path: artifact.path,
        expected: artifact.sha256,
        actual,
        matches,
      });
      continue;
    }

    allMatched = false;
    details.push({
      name: artifact.name || artifact.path,
      matches: false,
      detail: `unknown artifact kind: ${artifact.kind}`,
    });
  }

  return {
    valid: allMatched,
    reason: allMatched ? null : "Artifact, input, tool, or settings mismatch detected",
    manifestMeta: {
      schemaVersion: manifest.schemaVersion,
      timestamp: manifest.timestamp,
      commit: manifest.commit,
      isDirty: manifest.isDirty,
      releaseApproved: manifest.releaseApproved,
      tools: manifest.tools,
    },
    details,
  };
}

function printHelp() {
  console.log(`Usage:
  node scripts/verify-artifact-provenance.mjs --help
  node scripts/verify-artifact-provenance.mjs [--strict] [manifest-path]
  node scripts/verify-artifact-provenance.mjs --self-test

Options:
  --strict     Require releaseApproved=true and isDirty=false
  --self-test  Run deterministic offline fixture checks (no Hardhat/Rust required)
  --help       Show this help

If manifest-path is omitted, release-manifests/latest.json is used when present.`);
}

function runSelfTest() {
  const dir = mkdtempSync(join(tmpdir(), "gr-provenance-"));
  const wasmPath = join(dir, "sample.wasm");
  const evmPath = join(dir, "Sample.json");
  const inputPath = join(dir, "input.txt");
  const manifestPath = join(dir, "manifest.json");

  writeFileSync(wasmPath, Buffer.from("wasm-fixture-v1"));
  writeFileSync(inputPath, "source-v1\n");
  const creation = Buffer.from("6001600055", "hex");
  const deployed = Buffer.from("6001", "hex");
  const metadata = '{"compiler":{"version":"0.8.24"},"settings":{"evmVersion":"paris"}}';
  const abi = [{ type: "function", name: "ping", inputs: [], outputs: [] }];
  writeFileSync(
    evmPath,
    JSON.stringify({
      bytecode: `0x${creation.toString("hex")}`,
      deployedBytecode: `0x${deployed.toString("hex")}`,
      metadata,
      abi,
    }),
  );

  const good = {
    schemaVersion: 1,
    kind: "contract-artifact-provenance",
    timestamp: "2026-01-01T00:00:00.000Z",
    commit: "abc123",
    isDirty: false,
    releaseApproved: true,
    networkTarget: "unspecified",
    build: { evmCommand: "./scripts/build-evm.sh", sorobanCommand: "./scripts/build-soroban.sh" },
    tools: {
      solidity: EXPECTED.solidity,
      evmVersion: EXPECTED.evmVersion,
      viaIR: EXPECTED.viaIR,
      optimizer: { enabled: true, runs: EXPECTED.optimizerRuns },
      sorobanSdk: EXPECTED.sorobanSdk,
      wasmTarget: EXPECTED.wasmTarget,
      stellarCli: "26.1.0",
      node: process.version,
    },
    inputs: [{ name: "fixture-input", path: "input.txt", sha256: hashFile(inputPath) }],
    artifacts: [
      {
        name: "fixture-evm",
        path: "Sample.json",
        kind: "evm-bytecode",
        status: "found",
        creationBytecodeSha256: sha256Buffer(creation),
        deployedBytecodeSha256: sha256Buffer(deployed),
        metadataSha256: sha256Buffer(Buffer.from(metadata, "utf8")),
        abiSha256: sha256Buffer(Buffer.from(JSON.stringify(abi), "utf8")),
      },
      {
        name: "fixture-wasm",
        path: "sample.wasm",
        kind: "soroban-wasm",
        status: "found",
        sha256: hashFile(wasmPath),
      },
    ],
  };

  writeFileSync(manifestPath, `${JSON.stringify(good, null, 2)}\n`);
  const ok = verifyProvenanceManifest(manifestPath, {
    root: dir,
    strict: true,
    skipLiveSettings: true,
  });
  if (!ok.valid) {
    console.error("self-test failed: clean fixture should verify", ok);
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  // Artifact tamper
  writeFileSync(wasmPath, Buffer.from("wasm-fixture-TAMPERED"));
  const tamperedArtifact = verifyProvenanceManifest(manifestPath, {
    root: dir,
    strict: true,
    skipLiveSettings: true,
  });
  if (tamperedArtifact.valid) {
    console.error("self-test failed: wasm tamper not detected");
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  // Restore wasm, tamper source input
  writeFileSync(wasmPath, Buffer.from("wasm-fixture-v1"));
  writeFileSync(inputPath, "source-TAMPERED\n");
  const tamperedInput = verifyProvenanceManifest(manifestPath, {
    root: dir,
    strict: true,
    skipLiveSettings: true,
  });
  if (tamperedInput.valid) {
    console.error("self-test failed: input tamper not detected");
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  // Restore input, tamper manifest tool claim
  writeFileSync(inputPath, "source-v1\n");
  const badTools = structuredClone(good);
  badTools.tools.evmVersion = "shanghai";
  const badToolsPath = join(dir, "bad-tools.json");
  writeFileSync(badToolsPath, `${JSON.stringify(badTools, null, 2)}\n`);
  const tamperedTools = verifyProvenanceManifest(badToolsPath, {
    root: dir,
    strict: true,
    skipLiveSettings: true,
  });
  if (tamperedTools.valid) {
    console.error("self-test failed: tool claim tamper not detected");
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  // Dirty / non-approved rejected by --strict
  const dirty = structuredClone(good);
  dirty.isDirty = true;
  dirty.releaseApproved = false;
  const dirtyPath = join(dir, "dirty.json");
  writeFileSync(dirtyPath, `${JSON.stringify(dirty, null, 2)}\n`);
  const dirtyResult = verifyProvenanceManifest(dirtyPath, {
    root: dir,
    strict: true,
    skipLiveSettings: true,
  });
  if (dirtyResult.valid) {
    console.error("self-test failed: dirty manifest accepted under --strict");
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  rmSync(dir, { recursive: true, force: true });
  console.log("self-test passed: clean verify + artifact/input/tool/dirty detection");
}

function resolveDefaultManifest() {
  const latest = join(ROOT, "release-manifests", "latest.json");
  if (existsSync(latest)) return "release-manifests/latest.json";
  const dir = join(ROOT, "release-manifests");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  return files.length > 0 ? join("release-manifests", files[0]) : null;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--self-test")) {
    runSelfTest();
    process.exit(0);
  }

  const strict = args.includes("--strict");
  const pathArg = args.find((a) => !a.startsWith("--"));
  const manifestPath = pathArg || resolveDefaultManifest();

  if (!manifestPath) {
    console.error(
      "ERROR: No manifest path provided and no manifests found in ./release-manifests\n" +
        "Run with --help for usage.",
    );
    process.exit(1);
  }

  console.log(`Verifying provenance manifest: ${manifestPath}`);
  const result = verifyProvenanceManifest(manifestPath, { strict });

  console.log("\n--- Verification Results ---");
  for (const item of result.details) {
    const status = item.matches ? "OK" : "MISMATCH";
    console.log(`[${status}] ${item.name}${item.path ? ` (${item.path})` : ""}`);
    if (!item.matches) {
      if (item.detail) console.log(`   Detail:   ${item.detail}`);
      if (item.expected !== undefined) console.log(`   Expected: ${item.expected}`);
      if (item.actual !== undefined) console.log(`   Actual:   ${item.actual}`);
    }
  }

  if (!result.valid) {
    console.error(`\nVERIFICATION FAILED: ${result.reason || "checksum or schema mismatch"}`);
    process.exit(1);
  }

  console.log("\nVERIFICATION PASSED: schema, tools, inputs, and artifacts match.");
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main();
}
