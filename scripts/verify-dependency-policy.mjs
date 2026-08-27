#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = join(root, "docs", "security", "dependency-exceptions.json");
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const required = ["advisory", "package", "ecosystem", "impact", "rationale", "compensatingControl", "owner", "approvedBy", "expiresAt"];
const failures = [];
const today = new Date().toISOString().slice(0, 10);

if (
  policy.schemaVersion !== 1 ||
  !Array.isArray(policy.exceptions) ||
  !Array.isArray(policy.allowedInstallScripts) ||
  !Array.isArray(policy.licensePolicy?.allowedIdentifiers) ||
  !Array.isArray(policy.licensePolicy?.deniedExpressions)
) {
  failures.push("dependency-exceptions.json must use schemaVersion 1 with exception, install-script and license-policy arrays");
}

const exceptionKeys = new Set();
for (const [index, exception] of (policy.exceptions || []).entries()) {
  for (const field of required) {
    if (typeof exception[field] !== "string" || !exception[field].trim()) failures.push(`exception ${index} is missing ${field}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresAt || "")) failures.push(`exception ${index} has an invalid expiresAt`);
  if (exception.expiresAt < today) failures.push(`exception ${exception.advisory} expired on ${exception.expiresAt}`);
  const key = `${exception.ecosystem}:${exception.package}:${exception.advisory}`;
  if (exceptionKeys.has(key)) failures.push(`duplicate exception ${key}`);
  exceptionKeys.add(key);
}

const workspaces = [
  ["root", root],
  ["frontend", join(root, "frontend")],
  ["evm", join(root, "backend", "contracts")]
];
const licenseReview = new Map();

function classifyLicense(expression) {
  const normalized = typeof expression === "string" && expression.trim() ? expression.trim() : "NOASSERTION";
  if (policy.licensePolicy.deniedExpressions.includes(normalized)) return { disposition: "denied", expression: normalized };
  const identifiers = (normalized.match(/[A-Za-z0-9.-]+/g) || []).filter(
    (identifier) => !["AND", "OR", "WITH"].includes(identifier),
  );
  if (identifiers.length > 0 && identifiers.every((identifier) => policy.licensePolicy.allowedIdentifiers.includes(identifier))) {
    return { disposition: "allowed", expression: normalized };
  }
  return { disposition: "review", expression: normalized };
}

for (const [name, directory] of workspaces) {
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(directory, "package-lock.json"), "utf8"));
  const lockedRoot = lock.packages?.[""] || {};
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [dependency, range] of Object.entries(manifest[section] || {})) {
      if (lockedRoot[section]?.[dependency] !== range) failures.push(`${name}: ${dependency} is not synchronized in package-lock.json`);
    }
    for (const dependency of Object.keys(lockedRoot[section] || {})) {
      if (!(dependency in (manifest[section] || {}))) failures.push(`${name}: ${dependency} exists only in package-lock.json (${section})`);
    }
  }
  for (const [path, entry] of Object.entries(lock.packages || {})) {
    if (path && path.includes("node_modules/") && entry.version) {
      const packageName = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
      const license = classifyLicense(entry.license);
      if (license.disposition === "denied" && !exceptionKeys.has(`npm:${packageName}:license:${license.expression}`)) {
        failures.push(`${name}: denied license ${license.expression} in ${packageName}@${entry.version}`);
      }
      if (license.disposition === "review") {
        const key = `${license.expression}:${packageName}@${entry.version}`;
        licenseReview.set(key, (licenseReview.get(key) || 0) + 1);
      }
    }
    if (!entry.hasInstallScript) continue;
    const packageName = path.replace(/^node_modules\//, "").replace(/\/node_modules\//g, ">");
    if (!policy.allowedInstallScripts.includes(packageName)) failures.push(`${name}: unreviewed install script in ${packageName}`);
  }
}

if (process.argv.includes("--audit")) {
  for (const [name, directory] of workspaces) {
    const result = spawnSync("npm", ["audit", "--json", "--package-lock-only", "--omit=dev"], { cwd: directory, encoding: "utf8" });
    let report;
    try { report = JSON.parse(result.stdout); } catch { failures.push(`${name}: npm audit returned invalid JSON`); continue; }
    for (const vulnerability of Object.values(report.vulnerabilities || {})) {
      if (vulnerability.severity !== "critical") continue;
      const advisories = vulnerability.via.filter((item) => typeof item === "object").map((item) => item.url?.split("/").pop() || String(item.source));
      const identifiers = advisories.length ? advisories : ["npm-audit-critical"];
      for (const advisory of identifiers) {
        if (!exceptionKeys.has(`npm:${vulnerability.name}:${advisory}`)) failures.push(`${name}: unexcepted critical advisory ${advisory} in ${vulnerability.name}`);
      }
    }
  }
}

if (!existsSync(join(root, "soroban", "Cargo.lock"))) failures.push("Soroban Cargo.lock is required");

if (failures.length) {
  console.error("Dependency policy failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
if (licenseReview.size) {
  console.log(`License review required for ${licenseReview.size} locked package/version entries (including NOASSERTION/custom/copyleft expressions).`);
}
console.log(`Dependency policy passed (${policy.exceptions.length} active exceptions).`);
