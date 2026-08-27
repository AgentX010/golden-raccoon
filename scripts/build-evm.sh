#!/usr/bin/env bash
set -euo pipefail

# Reproducible EVM build. npm lifecycle scripts stay disabled until the
# dependency policy has reviewed them explicitly.

echo "=== EVM Reproducible Build ==="
echo "Compiler: Solidity 0.8.24 (Hardhat)"
echo "EVM target: paris"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend/contracts"

npx --no-install hardhat clean
npx --no-install hardhat compile

ARTIFACT="artifacts/contracts/GoldRaccoonPolicy.sol/GoldRaccoonPolicy.json"
if [ ! -f "$ARTIFACT" ]; then
  echo "ERROR: expected Hardhat artifact was not generated: $ARTIFACT" >&2
  exit 1
fi

ARTIFACTS=()
while IFS= read -r artifact; do
  ARTIFACTS+=("$artifact")
done < <(find artifacts/contracts -type f -name '*.json' ! -name '*.dbg.json' | LC_ALL=C sort)
node "$ROOT_DIR/scripts/verify-build-provenance.mjs" create evm "${ARTIFACTS[@]}"
node "$ROOT_DIR/scripts/verify-build-provenance.mjs" verify evm

echo "Build complete."
