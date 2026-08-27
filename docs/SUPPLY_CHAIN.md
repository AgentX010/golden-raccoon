# Supply-chain governance

`npm run sbom:generate` emits deterministic CycloneDX 1.6 inventories for the
frontend, Hardhat workspace and locked Soroban workspace under
`artifacts/sbom/`. `npm run supply-chain:policy:audit` rejects lockfile drift,
unreviewed install scripts, malformed or expired exceptions and unexcepted
critical npm advisories.

`scripts/build-evm.sh` and `scripts/build-soroban.sh` compile from reviewed
lockfiles and write SHA-256 provenance manifests under
`artifacts/provenance/`. A manifest records the source revision, exact build
command, tool versions and every produced contract artifact. Verification
re-hashes files; explorer links and deployment records are never treated as
build evidence.

CI uploads SBOMs and provenance separately so a reviewer can compare them
without running a build. Dependency updates are grouped by ecosystem but are
never auto-merged.

## License policy

The normative rules and review procedure are in
[`security/license-policy.md`](security/license-policy.md).

Permissive licenses including MIT, Apache-2.0, BSD, ISC, CC0-1.0, MPL-2.0 and
Unicode-3.0 are accepted. Copyleft, source-available, custom, unknown and
unresolved licenses require a time-bounded entry in
`dependency-exceptions.json`. The entry must explain distribution impact,
identify an owner and approver, document a compensating control and expire on
a concrete ISO date. Missing metadata is a policy failure, not approval.

## Emergency response and rollback

The operational containment, remediation, verification and rollback runbook is
[`security/emergency-dependency-response.md`](security/emergency-dependency-response.md).

Freeze releases, preserve the failing SBOM/audit/provenance evidence and
confirm the affected shipped path. Prefer a lockfile-only patch within the
existing major version; never run `npm audit fix --force`. When an immediate
upgrade is impossible, a security reviewer may approve a narrowly scoped
exception for no more than 30 days. Rebuild every contract, compare SBOMs and
verify provenance before release. If behavior or hashes diverge, roll back to
the last verified revision and its recorded build command. Private advisory
details, exploits and credentials must never enter public PR logs.
