#!/usr/bin/env bash
set -euo pipefail

# Reproducible Soroban WASM build. The lockfile is mandatory and the target is
# Stellar's wasm32v1-none runtime target.

echo "=== Soroban Reproducible Build ==="
echo "Soroban SDK: =26.0.1 (pinned in Cargo.toml)"
echo "Profile: release (opt-level=z, LTO, strip=symbols)"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/soroban"

cargo build --locked --release --target wasm32v1-none --workspace

WASM_ARTIFACTS=()
while IFS= read -r artifact; do
  WASM_ARTIFACTS+=("$artifact")
done < <(find target/wasm32v1-none/release -maxdepth 1 -type f -name '*.wasm' | LC_ALL=C sort)
if [ "${#WASM_ARTIFACTS[@]}" -eq 0 ]; then
  echo "ERROR: no Soroban WASM files were generated" >&2
  exit 1
fi

node "$ROOT_DIR/scripts/verify-build-provenance.mjs" create soroban "${WASM_ARTIFACTS[@]}"
node "$ROOT_DIR/scripts/verify-build-provenance.mjs" verify soroban

echo "Build complete."
