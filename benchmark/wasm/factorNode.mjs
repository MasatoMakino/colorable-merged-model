// Times FastEdgesGeometry in `dist` with one tableCapacityFactor per process.
// Usage: node benchmark/wasm/factorNode.mjs <workload> <1.5|2> [cold]
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  TorusKnotGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FastEdgesGeometry } from "../../dist/index.js";

const [workload, factorArg, mode] = process.argv.slice(2);
const factor = Number(factorArg);

function smallBoxes(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const b = new BoxGeometry(1, 1, 1);
    b.translate((i % 50) * 2, Math.floor(i / 50) * 2, 0);
    list.push(b);
  }
  return mergeGeometries(list);
}

// Same shape as the boxes in verifyNode.ts and tuneNode.ts
function tuneBoxes(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const g = new BoxGeometry(1, 1, 1);
    g.translate((i % 37) * 1.5, ((i / 37) | 0) % 37, (i / 1369) | 0);
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    list.push(g);
  }
  return mergeGeometries(list);
}

function soup(triangles) {
  const v = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t++) {
    const x = t * 2;
    v.set([x, 0, 0, x + 1, 0, 0, x, 1, 0], t * 9);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  return g;
}

/** @type {Record<string, () => [BufferGeometry, number]>} */
const workloads = {
  boxes30000: () => [tuneBoxes(30000), 7],
  torusKnot: () => [new TorusKnotGeometry(1, 0.3, 800, 128), 0.25],
  sphere: () => [new SphereGeometry(1, 512, 512), 1],
  boxes2500: () => [smallBoxes(2500), 1],
  soup: () => [soup(466000), 1],
};

const [geometry, threshold] = workloads[workload]();
const run = () => {
  const t0 = performance.now();
  new FastEdgesGeometry(geometry, threshold, { tableCapacityFactor: factor });
  return performance.now() - t0;
};

const cold = run();
if (mode === "cold") {
  console.log(JSON.stringify({ workload, factor, cold }));
  process.exit(0);
}
for (let i = 0; i < 5; i++) run();
const samples = [];
for (let i = 0; i < 21; i++) samples.push(run());
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ workload, factor, cold, warm: samples[10] }));
