// Node-side bit-identity check: src FastEdgesGeometry vs the three-free JS
// core vs the WASM port, on synthetic geometries covering index widths.
import { readFileSync } from "node:fs";
import {
  BoxGeometry,
  type BufferGeometry,
  MathUtils,
  SphereGeometry,
  TorusKnotGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FastEdgesGeometry } from "../../src/FastEdgesGeometry.js";
import { computeEdges } from "./edgesCore.js";
import { computeEdgesWasm, type EdgesWasmExports } from "./wasmEdges.js";

const wasmPath = process.argv[2];
const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath));
const ex = instance.exports as unknown as EdgesWasmExports;

function boxes(n: number): BufferGeometry {
  const list: BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const g = new BoxGeometry(1, 1, 1);
    g.translate((i % 37) * 1.5, ((i / 37) | 0) % 37, (i / 1369) | 0);
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    list.push(g);
  }
  return mergeGeometries(list);
}

const cases: [string, BufferGeometry, number][] = [
  ["box u16", new BoxGeometry(1, 1, 1, 3, 3, 3), 7],
  ["boxes 30k (u32)", boxes(30000), 7],
  ["sphere 523k tri", new SphereGeometry(1, 512, 512), 1],
  ["torusKnot 0.25deg", new TorusKnotGeometry(1, 0.3, 800, 128), 0.25],
  [
    "torusKnot non-indexed",
    new TorusKnotGeometry(1, 0.3, 400, 64).toNonIndexed(),
    7,
  ],
];

const same = (a: Float32Array, b: Float32Array) =>
  a.length === b.length &&
  Buffer.compare(
    Buffer.from(a.buffer, a.byteOffset, a.byteLength),
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  ) === 0;

let failed = 0;
for (const [name, geo, threshold] of cases) {
  const ref = new FastEdgesGeometry(geo, threshold).getAttribute("position")
    .array as Float32Array;
  const pos = geo.getAttribute("position").array as Float32Array;
  const idx = (geo.getIndex()?.array ?? null) as
    | Uint16Array
    | Uint32Array
    | null;
  const dot = Math.cos(MathUtils.DEG2RAD * threshold);
  const js = computeEdges(pos, idx, dot, 1e6);
  const wasm = computeEdgesWasm(ex, pos, idx, dot, 1e6);
  const okJs = same(ref, js);
  const okWasm =
    same(ref, wasm) &&
    same(ref, computeEdgesWasm(ex, pos, idx, dot, 1e6, undefined, 1000));
  if (!okJs || !okWasm) failed++;
  console.log(
    `${name}: idx=${idx ? idx.constructor.name : "none"} segments=${ref.length / 6} js=${okJs} wasm=${okWasm} wasmSegments=${wasm.length / 6}`,
  );
}
console.log(failed === 0 ? "ALL BIT-IDENTICAL" : `FAILED: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
