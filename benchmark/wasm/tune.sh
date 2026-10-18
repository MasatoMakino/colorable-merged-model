#!/bin/bash
# Compile AssemblyScript variants and time them in Node. Run inside the
# DevContainer: bash benchmark/wasm/tune.sh <rounds> <variant> [<variant> ...]
# A variant name maps to benchmark/wasm/assembly/variants/<name>.ts. A name
# with a "@copy" suffix reuses the binary of <name> (noise-floor control).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/benchmark/wasm"
OUT="$SRC/build/variants"
mkdir -p "$OUT"
rounds="$1"
shift
wasms=()
for name in "$@"; do
  base="${name%@copy}"
  if [ "$base" = "$name" ]; then
    npx asc "$SRC/assembly/variants/$base.ts" -o "$OUT/$base.wasm" \
      -O3 --runtime stub --noAssert --enable nontrapping-f2i --disable simd
    wasms+=("$OUT/$base.wasm")
  else
    cp "$OUT/$base.wasm" "$OUT/$base-copy.wasm"
    wasms+=("$OUT/$base-copy.wasm")
  fi
done
npx esbuild "$SRC/tuneNode.ts" --bundle --platform=node --format=esm \
  --outfile="$SRC/build/tuneNode.mjs" --log-level=warning
node --expose-gc "$SRC/build/tuneNode.mjs" "$rounds" "${wasms[@]}"
