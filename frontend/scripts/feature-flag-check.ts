// Feature-flag deploy / rollback verification.
//
// Proves at deploy time that:
//   1. Configuration is valid (no unknown flags, no invalid values).
//   2. Dangerous capabilities default OFF when unconfigured (fail closed).
//
// Exits non-zero on any violation so CI can block a bad deploy or an
// accidental rollback that would re-enable a dangerous capability.

import { featureFlagRegistry } from "@/server/features/registry";
import {
  evaluateFeature,
  getFeatureConfigIssues,
  getFeatureEnvironment,
} from "@/server/features/evaluator";
import type { FeatureFlagKey } from "@/server/features/types";

function main(): void {
  const environment = getFeatureEnvironment();
  const issues = getFeatureConfigIssues();

  console.log(`Feature flag environment: ${environment}`);

  if (issues.length > 0) {
    console.error("\nFeature flag configuration is invalid (failing closed):");
    for (const issue of issues) {
      console.error(`  - ${issue.key}: ${issue.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  const keys = Object.keys(featureFlagRegistry) as FeatureFlagKey[];
  let violations = 0;

  for (const key of keys) {
    const decision = evaluateFeature(key, { identifier: "deploy_probe", environment });
    console.log(`  ${key}: ${decision.enabled ? "enabled" : "disabled"} (${decision.reason})`);

    // Fail-closed guarantee: a dangerous capability must never be enabled by
    // default. If it is enabled without an explicit "on"/rollout config, that
    // is a rollback/verification failure.
    if (
      featureFlagRegistry[key].safeDefault === false &&
      decision.enabled &&
      decision.reason === "default"
    ) {
      console.error(`  !! ${key} is a dangerous capability but defaulted to enabled.`);
      violations += 1;
    }
  }

  if (violations > 0) {
    console.error(`\nFail-closed verification failed with ${violations} violation(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("\nFeature flag verification passed (config valid, dangerous capabilities default off).");
}

main();
