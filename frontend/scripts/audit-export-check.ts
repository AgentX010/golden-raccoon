// Audit-bundle export verification.
//
// Proves the privacy invariants hold at the module level:
//   1. Redaction removes raw wallet/balance/strategy/payload/secret/XDR values.
//   2. The canonical hash is stable and any material change fails verification.
//   3. Unknown versions fail closed.
//   4. No raw wallet identifier appears anywhere in the serialized bundle.
//
// Exits non-zero on any violation so CI can block a privacy regression.

import {
  buildAuditBundle,
  buildAuditBundleHash,
  type AuditBundle,
} from "@/server/privacy/auditBundle";
import { redactApproval, redactDecision, redactTransaction } from "@/server/privacy/auditRedaction";
import { verifyAuditBundle } from "@/server/privacy/auditVerify";
import type { RecommendationRecord, TransactionRecord, UserApprovalRecord } from "@/server/types";

const WALLET = "0x1111111111111111111111111111111111111111";

function sampleRecords() {
  const decision: RecommendationRecord = {
    id: "rec_1",
    walletAddress: WALLET,
    action: "reduce_exposure",
    decisionScore: 82,
    confidence: 0.9,
    summary: "Reduce exposure to volatile asset.",
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const approval: UserApprovalRecord = {
    id: "approval_1",
    walletAddress: WALLET,
    decisionId: "rec_1",
    txHash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    network: "goat",
    action: "reduce_exposure",
    status: "confirmed",
    autoExecuted: false,
    createdAt: "2026-08-01T00:01:00.000Z",
  };
  const transaction: TransactionRecord = {
    hash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    type: "swap",
    asset: "ETH",
    valueUsd: 100,
    status: "confirmed",
    lifecycleStatus: "confirmed",
    chainFamily: "evm",
    createdAt: "2026-08-01T00:01:00.000Z",
    network: "goat",
    walletAddress: WALLET,
    sourceAccount: WALLET,
    calldata: "0x0000000000000000000000000000000000000000000000000000000000000000",
    stellarDetails: { envelopeXdr: "AAAAAg==", resultXdr: "AAAAAw==" },
  };
  return { decision, approval, transaction };
}

function main(): void {
  const { decision, approval, transaction } = sampleRecords();

  const bundle = buildAuditBundle({
    walletAddress: WALLET,
    chainFamily: "evm",
    network: "goat",
    productVersion: "0.1.0",
    decisions: [decision],
    approvals: [approval],
    transactions: [transaction],
    redact: { decision: redactDecision, approval: redactApproval, transaction: redactTransaction },
  });

  const hash = buildAuditBundleHash(bundle);
  const serialized = JSON.stringify(bundle);

  const failures: string[] = [];

  // 1. No raw identifier or sensitive value leaks into the bundle.
  const forbidden = [WALLET, transaction.calldata!, transaction.stellarDetails!.envelopeXdr!, transaction.stellarDetails!.resultXdr!];
  for (const value of forbidden) {
    if (value && serialized.includes(value)) {
      failures.push(`raw sensitive value leaked into bundle: ${value.slice(0, 24)}…`);
    }
  }

  // 2. Stable hash: rebuilding yields the same hash.
  if (buildAuditBundleHash(bundle) !== hash) {
    failures.push("canonical hash is not stable across rebuilds");
  }

  // 3. Verification passes on an intact bundle.
  const verified = verifyAuditBundle(bundle, hash);
  if (!verified.valid) {
    failures.push(`intact bundle failed verification: ${JSON.stringify(verified.issues)}`);
  }

  // 4. Tampering fails verification.
  const tampered: AuditBundle = JSON.parse(serialized);
  tampered.transactions[0].valueUsd = 999;
  const tamperResult = verifyAuditBundle(tampered, hash);
  if (tamperResult.valid) {
    failures.push("tampered bundle incorrectly verified as valid");
  }

  // 5. Unknown version fails closed.
  const unknownVersion = { ...bundle, version: 999 } as AuditBundle;
  const versionResult = verifyAuditBundle(unknownVersion);
  if (versionResult.valid) {
    failures.push("unknown bundle version did not fail closed");
  }

  if (failures.length > 0) {
    console.error("\nAudit-bundle export verification failed:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Audit-bundle export verification passed (hash ${hash.slice(0, 12)}…).`);
  console.log(`  decisions=${bundle.decisions.length} approvals=${bundle.approvals.length} transactions=${bundle.transactions.length}`);
}

main();
