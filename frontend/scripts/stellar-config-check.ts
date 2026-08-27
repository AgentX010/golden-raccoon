import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executeWithFallback } from "../src/lib/stellar/failover";
import { scanNetworks } from "../src/lib/scanNetworks";
import { stellarNetworks, validateStellarNetworkConfig } from "../src/lib/stellar/config";

async function main() {
  for (const network of Object.values(stellarNetworks)) {
    const validation = validateStellarNetworkConfig(network);
    assert.equal(validation.ok, true, validation.issues.join(" "));
    assert.equal(network.rpcUrls.length >= 2, true, `${network.id} must have an RPC fallback`);
    assert.equal(new Set(network.rpcUrls.map((url) => new URL(url).hostname)).size >= 2, true, `${network.id} providers must be independent`);
    assert.equal(network.x402UsdcContract.startsWith("C"), true);
    assert.equal(network.caip2, network.id === "stellar-pubnet" ? "stellar:pubnet" : "stellar:testnet");
  }

  const invalidPassphrase = validateStellarNetworkConfig({ ...stellarNetworks["stellar-testnet"], networkPassphrase: "wrong" });
  assert.equal(invalidPassphrase.ok, false, "Passphrase mismatch must fail closed");
  const invalidContract = validateStellarNetworkConfig({ ...stellarNetworks["stellar-testnet"], registryContractId: "invalid" });
  assert.equal(invalidContract.ok, false, "Invalid registry contract must fail closed");
  const missingRequiredRegistry = validateStellarNetworkConfig({ ...stellarNetworks["stellar-testnet"], registryContractId: undefined }, { requireRegistry: true });
  assert.equal(missingRequiredRegistry.ok, false, "Required registry contract must fail closed");

  const fallback = await executeWithFallback(["https://primary.invalid", "https://fallback.example"], async (_url, index) => {
    if (index === 0) throw new Error("primary unavailable");
    return "healthy";
  });
  assert.equal(fallback.value, "healthy");
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(fallback.attempts.length, 2);

  for (const network of scanNetworks.filter((entry) => entry.chainFamily === "stellar")) {
    assert.equal(network.goPlusChainId, undefined, `${network.id} must not expose an EVM GoPlus chain ID`);
    assert.equal(network.dexScreenerChainId, undefined, `${network.id} must not require an EVM market chain ID`);
  }

  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string> };
  for (const dependency of ["@stellar/stellar-sdk", "@creit.tech/stellar-wallets-kit", "server-only"]) {
    assert.ok(packageJson.dependencies[dependency], `${dependency} must be declared`);
  }

  console.log("Stellar configuration checks passed.");
}

void main();
