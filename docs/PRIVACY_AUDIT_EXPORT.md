# Privacy Audit Bundle Export

A verifiable, privacy-preserving export of a wallet's decision → approval →
transaction lifecycle. The bundle proves **what happened** without exposing
**unrelated holdings, provider payloads, secrets, signed XDR, or full wallet
identifiers**.

## What's in the bundle

- **Decisions** — recommendation action, score, confidence, summary, and
  evidence digests (no raw provider payload).
- **Approvals** — approval transitions (id, tx hash, network, action, status).
- **Transactions** — lifecycle observations (type, asset, value, status,
  timestamps, evidence digests). Signed XDR and calldata are never included.
- **Scope** — a one-way SHA-256 wallet hash, network identity, and the selected
  record ids (never the raw wallet address).

## What's redacted

| Category | Field(s) |
|----------|----------|
| Wallet identifiers | `walletAddress`, `sourceAccount` |
| Balances / strategies | `inputSnapshot`, `expectedEffects` |
| Provider payloads | raw provider results, `calldata` |
| Secrets / signed XDR | `stellarDetails.envelopeXdr`, `stellarDetails.resultXdr` |
| Internal notes | `policyStatus`, internal fields |

## Verifying a bundle

1. Compute the canonical hash with `buildAuditBundleHash(bundle)` and compare it
   to the `hash` field returned by the export endpoint.
2. Or run the local check:

   ```bash
   npm run test:audit-export
   ```

The hash is deterministic (sorted-key canonical JSON). Any material change to
the bundle changes the hash, so tampering is detectable.

## Limits & safety

- Requires an authenticated, wallet-scoped session. Wallet A cannot select or
  export wallet B's records.
- Rate-limited and bounded by `AUDIT_EXPORT_MAX_SELECTION`,
  `AUDIT_EXPORT_MAX_RECORDS_PER_SECTION`, and `AUDIT_EXPORT_MAX_BYTES`.
- The server records a minimal audit event (wallet hash + counts) but never
  retains the generated bundle bytes.
