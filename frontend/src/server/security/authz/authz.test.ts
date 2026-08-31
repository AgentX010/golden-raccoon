import { beforeEach, describe, expect, it } from "vitest";
import { clearAuthzAuditForTests, listAuthzAuditEntries } from "./auditTrail";
import { evaluateCapability } from "./evaluator";
import { createSubject } from "./subject";

describe("capability authorization", () => {
  beforeEach(() => clearAuthzAuditForTests());

  it("enforces wallet ownership and network scope", () => {
    const subject = createSubject({ walletAddress: "0xabc", chainFamily: "evm", network: "testnet" });
    expect(evaluateCapability(subject, "portfolio:read", { walletAddress: "0xABC", chainFamily: "evm", network: "testnet" }).allowed).toBe(true);
    expect(evaluateCapability(subject, "portfolio:read", { walletAddress: "0xdef", chainFamily: "evm", network: "testnet" })).toMatchObject({ allowed: false, reason: "resource_owner_mismatch" });
    expect(evaluateCapability(subject, "portfolio:read", { walletAddress: "0xabc", chainFamily: "evm", network: "mainnet" })).toMatchObject({ allowed: false, reason: "scope_mismatch" });
  });

  it("records redacted allow and deny decisions and never grants signing", () => {
    const subject = createSubject({ walletAddress: "0x1234567890123456789012345678901234567890" });
    expect(evaluateCapability(subject, "watchlist:write", { walletAddress: subject.walletAddress }).allowed).toBe(true);
    expect(evaluateCapability(subject, "execution:submit", { walletAddress: subject.walletAddress })).toMatchObject({ allowed: true });
    expect(evaluateCapability(subject, "execution:submit", { walletAddress: subject.walletAddress, serverSigning: true })).toMatchObject({ allowed: false, reason: "server_signing_forbidden" });
    const audit = listAuthzAuditEntries();
    expect(audit).toHaveLength(3);
    expect(JSON.stringify(audit)).not.toContain(subject.walletAddress);
    expect(audit.map((entry) => entry.decision)).toEqual(["allow", "allow", "deny"]);
  });
});
