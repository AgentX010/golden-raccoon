# Auto Mode guardrails

Auto Mode candidates are evaluated by `server/autoMode/sandbox` before any
transaction path. The evaluator returns a deterministic guardrail proof with
the policy version/hash, input snapshot hash, every limit and observed value,
and the first binding constraint. The sandbox has no transaction adapter
dependency and returns `sideEffects: "none"`.

The process-scoped kill switch is chain and network scoped. It records the
operator, reason, and timestamp; an unreadable state is treated as engaged, and
re-enable is an explicit operation. Backtests sort fixture IDs and therefore
produce stable counts and binding-constraint frequencies.
