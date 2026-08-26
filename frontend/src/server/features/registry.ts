import type { FeatureFlagDef, FeatureFlagKey } from "./types";

// Central typed registry. This is the single source of truth for flag
// ownership, purpose, safe defaults, scope, dependencies, and review/removal
// dates. Add new capabilities here rather than scattering ad-hoc env checks.

export const featureFlagRegistry: Record<FeatureFlagKey, FeatureFlagDef> = {
  scan_token: {
    key: "scan_token",
    owner: "scan",
    purpose: "Token scan (contract + security) capability.",
    safeDefault: true,
    scope: "network",
    environments: ["development", "test", "production"],
    dependencies: [],
    reviewDate: "2026-09-01",
    removalDate: "2026-12-31",
  },
  execute_prepare: {
    key: "execute_prepare",
    owner: "execution",
    purpose: "Build an approval-only execution preview.",
    safeDefault: false,
    scope: "execution",
    environments: ["development", "test", "production"],
    dependencies: [],
    reviewDate: "2026-09-01",
    removalDate: "2026-12-31",
  },
  execute_submit: {
    key: "execute_submit",
    owner: "execution",
    purpose: "Submit a user-signed transaction.",
    safeDefault: false,
    scope: "execution",
    environments: ["development", "test", "production"],
    dependencies: ["execute_prepare"],
    reviewDate: "2026-09-01",
    removalDate: "2026-12-31",
  },
  auto_mode_authorization: {
    key: "auto_mode_authorization",
    owner: "execution",
    purpose: "Auto-mode authorization flow.",
    safeDefault: false,
    scope: "execution",
    environments: ["development", "test", "production"],
    dependencies: ["execute_prepare"],
    reviewDate: "2026-09-01",
    removalDate: "2026-12-31",
  },
  x402_stellar_deep_scan: {
    key: "x402_stellar_deep_scan",
    owner: "x402",
    purpose: "Payment-gated Stellar deep scan.",
    safeDefault: false,
    scope: "network",
    environments: ["development", "test", "production"],
    dependencies: [],
    reviewDate: "2026-09-01",
    removalDate: "2026-12-31",
  },
};

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return value in featureFlagRegistry;
}

export function getFeatureFlagDef(key: FeatureFlagKey): FeatureFlagDef {
  return featureFlagRegistry[key];
}
