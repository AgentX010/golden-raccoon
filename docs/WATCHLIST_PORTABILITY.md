# Watchlist Portability

This document details the bulk import and export formats for watchlists.

## JSON Format
JSON format uses a \`1.0.0\` versioning system. It contains \`walletAddress\`, \`exportedAt\`, and an \`entries\` array.

## CSV Format
Same fields as the JSON entries, encoded with CSV safe strings. Formula injections are prevented by prefixing risky cells.

## Canonical Identity
Same-symbol/different-issuer and same-contract/different-network entries will not collide as identities are deterministically recomputed based on chain, network, contract, or asset keys.

## Dry-run Support
Append \`?dry_run=true\` to safely parse without saving.
