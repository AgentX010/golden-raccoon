import { recordAuditEvent } from "@/server/observability/executionAudit";

import type { FeatureFlagDecision, FeatureFlagKey } from "./types";

// Audit logging for feature-flag evaluation. Reuses the shared execution audit
// sink so flag decisions live alongside the rest of the audit trail. Events
// carry the flag, decision, reason, environment, and a correlation id — never
// the raw rollout identifier or any secret.

export interface FeatureFlagAuditInput {
  key: FeatureFlagKey;
  decision: FeatureFlagDecision;
  environment: string;
  network?: string;
  correlationId: string;
}

export function recordFeatureFlagEvaluation(input: FeatureFlagAuditInput): void {
  recordAuditEvent({
    id: `feature_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    correlationId: input.correlationId,
    kind: input.decision.enabled ? "policy_evaluated" : "policy_blocked",
    occurredAt: new Date().toISOString(),
    outcome: input.decision.enabled ? "ok" : "blocked",
    network: input.network,
    detail: JSON.stringify({
      flag: input.decision.key,
      enabled: input.decision.enabled,
      reason: input.decision.reason,
      environment: input.environment,
      network: input.network ?? null,
    }),
  });
}

/**
 * Build a non-sensitive summary context for a feature evaluation. Intended for
 * health/operations surfaces — it exposes the flag key, decision, and reason
 * but never the raw rollout identifier.
 */
export function summarizeFeatureDecision(decision: FeatureFlagDecision): {
  key: FeatureFlagKey;
  enabled: boolean;
  reason: string;
} {
  return {
    key: decision.key,
    enabled: decision.enabled,
    reason: decision.reason,
  };
}


