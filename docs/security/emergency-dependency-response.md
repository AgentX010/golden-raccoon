# Emergency dependency response

Use this runbook for a critical advisory, compromised maintainer account, malicious install script, registry incident, or unexpected contract artifact hash.

## Contain

1. Freeze deployments and Dependabot merges. Preserve the failing workflow logs, SBOMs, provenance manifests and affected lockfiles.
2. Identify the exact package version, ecosystem, reachable product path and first known affected release. Keep exploit details and credentials out of public issues and CI output.
3. Revoke exposed credentials and signing material through the owning provider. Never commit replacement secrets.

## Remediate

Prefer a minimal lockfile update inside the existing major version. Run installs with lifecycle scripts disabled, review every newly enabled install script, and do not use `npm audit fix --force`. For Soroban, keep `--locked` enabled and review every changed checksum.

If no safe version exists, a security reviewer may approve a narrowly scoped exception for at most 30 days. The exception must name the advisory, affected package and ecosystem, impact, rationale, compensating control, owner, approver, and expiry. Private vulnerability details belong in the organization’s restricted incident record.

## Verify and release

1. Run dependency policy and live critical-advisory checks.
2. Regenerate frontend, EVM and Soroban SBOMs; review component and license deltas.
3. Rebuild EVM bytecode and Soroban WASM from locked inputs. Verify every provenance digest.
4. Run the existing application, Hardhat and Cargo test gates before deployment.
5. Attach CI artifact identifiers and the reviewed source revision to the release record.

## Roll back

Roll back to the last source revision whose SBOM and provenance manifests were retained and verified. Restore its lockfiles as a unit; never mix a prior artifact with newer dependency metadata. Re-run the locked build and compare hashes before redeploying. Keep the deployment frozen if hashes diverge or the prior revision is also affected.

After containment, document detection gaps, rotate temporary controls out, remove expired exceptions, and schedule a follow-up review without publishing sensitive incident material.
