// Typed feature-flag registry. Each flag carries ownership, purpose, a safe
// default, environment/network scope, dependencies, and review/removal dates.
// Dangerous capabilities default OFF; the evaluator fails closed on anything
// unknown, expired, invalid, or whose dependency is disabled.

export type FeatureFlagKey =
  | "scan_token"
  | "execute_prepare"
  | "execute_submit"
  | "auto_mode_authorization"
  | "x402_stellar_deep_scan";

export type FeatureEnvironment = "development" | "test" | "production";

export type FeatureScope = "network" | "execution";

export interface FeatureFlagDef {
  key: FeatureFlagKey;
  /** Team or system that owns the flag and can approve its removal. */
  owner: string;
  purpose: string;
  /**
   * Value used when the flag is not explicitly configured. Dangerous
   * capabilities (execution, auto-mode, payment-gated endpoints) default to
   * `false` so an unconfigured deployment fails closed.
   */
  safeDefault: boolean;
  scope: FeatureScope;
  environments: FeatureEnvironment[];
  /** Flags that must be enabled for this flag to evaluate enabled. */
  dependencies: FeatureFlagKey[];
  /** ISO date (YYYY-MM-DD) when the flag must be re-reviewed. */
  reviewDate: string;
  /** ISO date (YYYY-MM-DD) after which the flag is treated as expired/off. */
  removalDate: string;
}

export type FeatureDecisionReason =
  | "default"
  | "configured"
  | "rollout"
  | "dependency"
  | "expired"
  | "unknown";

export interface FeatureFlagDecision {
  key: FeatureFlagKey;
  enabled: boolean;
  reason: FeatureDecisionReason;
  /** Stable rollout bucket (0-99) when reason === "rollout"; undefined otherwise. */
  rolloutBucket?: number;
  detail: string;
}

export interface FeatureEvaluationContext {
  /**
   * One-way identifier used for rollout bucketing. Callers MUST pass a hashed
   * or otherwise non-reversible value — never a raw wallet address.
   */
  identifier: string;
  environment: FeatureEnvironment;
  network?: string;
}
