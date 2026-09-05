# Capability authorization model

API handlers declare one capability from `server/security/authz/capabilities.ts`
and evaluate it before touching wallet-scoped state. A subject is either
anonymous or a wallet session; ownership and chain/network scope are checked by
the same evaluator. Denials expose a generic `auth_error` and a typed reason,
never the requested resource.

Audit entries are append-only and store only a truncated SHA-256 subject hash,
capability, scope, decision and reason. `execution:submit` represents a
user-signed payload; it cannot authorize server signing. Passing
`serverSigning: true` is always denied and `assertApprovalOnly` remains the
authoritative execution guard.
