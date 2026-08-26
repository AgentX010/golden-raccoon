/**
 * Redaction rules for the audit bundle. Strips anything that could expose
 * unrelated holdings, strategies, provider payloads, secrets, signed XDR, or
 * full wallet identifiers. Only the minimum needed to prove the decision →
 * approval → transaction chain survives.
 */

import {
  digestEvidence,
  type AuditApprovalEntry,
  type AuditDecisionEntry,
  type AuditTransactionEntry,
} from "./auditBundle";
import type {
  RecommendationRecord,
  TransactionRecord,
  UserApprovalRecord,
} from "@/server/types";

/** Field paths we never emit — documented for reviewers and the privacy UI. */
export const AUDIT_REDACTED_FIELDS = [
  "walletAddress",
  "sourceAccount",
  "calldata",
  "stellarDetails.envelopeXdr",
  "stellarDetails.resultXdr",
  "expectedEffects",
  "policyStatus",
  "inputSnapshot",
] as const;

/** Drop a value (and its key) from an object spread — used only for clarity. */
export function redactDecision(record: RecommendationRecord): AuditDecisionEntry {
  return {
    id: record.id,
    createdAt: record.createdAt,
    action: record.action,
    decisionScore: record.decisionScore,
    confidence: record.confidence,
    summary: record.summary,
    evidence: [digestEvidence(record.id, "quote", record.summary)],
  };
}

export function redactApproval(record: UserApprovalRecord): AuditApprovalEntry {
  return {
    id: record.id,
    createdAt: record.createdAt,
    txHash: record.txHash,
    network: record.network,
    action: record.action,
    status: record.status,
  };
}

export function redactTransaction(record: TransactionRecord): AuditTransactionEntry {
  const evidencePayload = JSON.stringify({
    type: record.type,
    status: record.status,
    network: record.network,
    valueUsd: record.valueUsd,
  });
  return {
    hash: record.hash,
    type: record.type,
    asset: record.asset,
    valueUsd: record.valueUsd,
    status: record.status,
    createdAt: record.createdAt,
    terminalAt: record.terminalAt,
    network: record.network,
    decisionId: record.decisionId,
    evidence: [digestEvidence(record.hash, "receipt", evidencePayload)],
  };
}
