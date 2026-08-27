# Transaction reconciliation

The lifecycle records what providers report; it never signs, resubmits, replaces, or gas-bumps a user transaction. A wallet broadcast response produces only `submitted`.

## Finality policy

- EVM requires `EVM_CONFIRMATION_DEPTH` confirmations (default 3). A successful receipt below that depth is `confirming`, not final.
- Stellar requires `STELLAR_FINALITY_LEDGERS` ledgers (default 2). A successful RPC result below that depth is also `confirming`.
- Explorer URLs are navigation aids and carry `confirmationEvidence: false`; they are never accepted as evidence.

Every poll creates an immutable observation keyed by provider, status, inclusion block or ledger, confirmation count, and replacement evidence. Repeated evidence is idempotent. Polling stops after 50 attempts and routes the record to manual review instead of retrying forever.

## Transition rules

`prepared -> submitted -> pending -> confirming -> confirmed` is the normal path. Failed, replaced, dropped, expired, and user-rejected outcomes are terminal. Confirmed records may only remain confirmed or move to reorg/manual review when new evidence conflicts. All other regressions are rejected and recorded as manual-review events.

- A changed inclusion block hash or disappearance after inclusion produces `reorged`.
- Explicit same-sender/nonce replacement evidence produces `replaced` and retains the replacement hash.
- Three consecutive not-found observations before inclusion produce `dropped`.
- Conflicting providers or conflicting terminal outcomes produce `manual_review`.
- Stellar duplicate status is recorded without creating another execution record.

## Operations

The status and history APIs return observations, transition events, confirmation progress, finality, replacement hash, and review reason. Operators should compare provider evidence and the wallet activity before asking the user to take a new action. The server must never automatically replay a missing transaction.

Run `npm --prefix frontend run test:reconciliation` for deterministic EVM replacement/reorg/drop/disagreement and Stellar pending/duplicate/failure/finality fixtures.
