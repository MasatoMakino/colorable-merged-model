#!/bin/bash
# Build the WASM benchmark into docs/demo/_bench (git-ignored). Run inside the
# DevContainer: devcontainer exec --workspace-folder . bash benchmark/wasm/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/benchmark/wasm"
OUT="$ROOT/docs/demo/_bench"
mkdir -p "$OUT" "$SRC/build"

npx asc "$SRC/assembly/edges.ts" -o "$SRC/build/edges.wasm" \
  -O3 --runtime stub --noAssert --enable nontrapping-f2i --disable simd
cp "$SRC/build/edges.wasm" "$OUT/edges.wasm"

npx esbuild "$SRC/bench.ts" "$SRC/controller.ts" "$SRC/worker.ts" \
  --bundle --format=esm --target=es2022 --outdir="$OUT" --log-level=warning

for page in bench controller; do
  cat > "$OUT/$page.html" <<EOF
<!doctype html>
<html><head><meta charset="utf-8"><title>$page</title></head>
<body><div id="status">running</div><script type="module" src="$page.js"></script></body></html>
EOF
done
ls -la "$OUT"
