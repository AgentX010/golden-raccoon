# Backend scope

The active application server is the Next.js server under `frontend/src/server` and `frontend/src/app/api`. The former duplicated TypeScript backend and SQLite Prisma schema were removed after verifying that no runtime, build, deployment, or test imports referenced them.

`backend/contracts` remains intentionally separate because it contains the legacy EVM smart-contract workspace. Stellar contracts live under `soroban/`.

## Reproducible EVM builds and provenance

Pinned compiler settings in `backend/contracts/hardhat.config.ts`:

- Solidity `0.8.24`
- `evmVersion: "paris"`
- `viaIR: true`
- optimizer `runs: 200`
- metadata `bytecodeHash: "ipfs"` with `useLiteralContent: true`

Build, freeze, and verify (repo root):

```bash
npm run build:evm
npm run provenance:freeze -- --write --release
npm run provenance:verify -- --strict release-manifests/latest.json
```

Provenance manifests record **creation bytecode** and Solidity metadata hashes (not only whole JSON file hashes). Deploy scripts require a verified manifest path. See `docs/BUILD_PROVENANCE.md`.
