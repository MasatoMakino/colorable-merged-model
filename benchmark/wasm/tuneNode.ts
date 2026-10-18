// Node-side tuning harness for AssemblyScript variants of the WASM port.
// Usage: node tuneNode.mjs <rounds> <a.wasm> <b.wasm> ...
// Every variant must be bit-identical to src (single call and chunked) on
// every workload before any timing runs. Samples interleave variants.
import { readFileSync } from "node:fs";
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  SphereGeometry,
  TorusKnotGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FastEdgesGeometry } from "../../src/FastEdgesGeometry.js";
import {
  computeEdgesWasm,
  DEFAULT_CAPACITY_FACTOR,
  type EdgesWasmExports,
  type StageTimings,
} from "./wasmEdges.js";

const [roundsArg, ...files] = process.argv.slice(2);
const rounds = Number.parseInt(roundsArg, 10);
const gc = (globalThis as { gc?: () => void }).gc ?? (() => {});

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

interface Workload {
  name: string;
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
  dot: number;
  ref: Float32Array;
}

// Worst case for the hash-table load factor: disconnected triangles, so no
// directed edge ever matches. 466,000 triangles put indexCount just under
// 2^21 / 1.5, where a 1.5x capacity factor lands at load 0.67.
function soup(triangles: number): BufferGeometry {
  const pos = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t++) {
    const o = t * 9;
    const x = t % 1000;
    const y = (t / 1000) | 0;
    pos.set([x, y, 0, x + 0.5, y, 0, x, y + 0.5, 0.25], o);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  return g;
}

// A rounds argument of "<n>:soup" times only the worst-case workload.
const soupOnly = roundsArg.endsWith(":soup");
const workloads: Workload[] = (
  (soupOnly
    ? [["soup466k", soup(466000), 7]]
    : [
        ["sphere", new SphereGeometry(1, 512, 512), 1],
        ["boxes30k", boxes(30000), 7],
        ["torusKnot", new TorusKnotGeometry(1, 0.3, 800, 128), 0.25],
      ]) as [string, BufferGeometry, number][]
).map(([name, geo, threshold]) => ({
  name,
  position: geo.getAttribute("position").array as Float32Array,
  index: (geo.getIndex()?.array ?? null) as Uint16Array | Uint32Array | null,
  dot: Math.cos(MathUtils.DEG2RAD * threshold),
  ref: new FastEdgesGeometry(geo, threshold).getAttribute("position")
    .array as Float32Array,
}));

const sameBits = (a: Float32Array, b: Float32Array) =>
  a.length === b.length &&
  Buffer.compare(
    Buffer.from(a.buffer, a.byteOffset, a.byteLength),
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  ) === 0;

const modules = files.map((f) => new WebAssembly.Module(readFileSync(f)));
const instantiate = (m: WebAssembly.Module) =>
  new WebAssembly.Instance(m).exports as unknown as EdgesWasmExports;

// --- Correctness gate ---
for (let v = 0; v < files.length; v++) {
  const ex = instantiate(modules[v]);
  for (const w of workloads) {
    const single = computeEdgesWasm(ex, w.position, w.index, w.dot, 1e6);
    const chunked = computeEdgesWasm(
      ex,
      w.position,
      w.index,
      w.dot,
      1e6,
      undefined,
      4096,
    );
    if (!sameBits(single, w.ref) || !sameBits(chunked, w.ref)) {
      console.error(`GATE FAIL: ${files[v]} on ${w.name}`);
      process.exit(1);
    }
  }
}
console.log(
  `gate passed: ${files.length} variants x ${workloads.length} workloads`,
);

// --- Optional phase split (rounds = 0): weld / pair / finish, warm run ---
if (rounds === 0) {
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  for (let v = 0; v < files.length; v++) {
    for (const w of workloads) {
      const weld: number[] = [];
      const pair: number[] = [];
      const fin: number[] = [];
      for (let r = 0; r < 7; r++) {
        gc();
        const ex = instantiate(modules[v]);
        computeEdgesWasm(ex, w.position, w.index, w.dot, 1e6);
        const pc = w.position.length / 3;
        const ic = w.index ? w.index.length : pc;
        ex.prepare(
          pc,
          ic,
          w.index ? w.index.BYTES_PER_ELEMENT : 0,
          DEFAULT_CAPACITY_FACTOR,
        );
        const buf = ex.memory.buffer;
        new Float32Array(buf, ex.positionPtr(), w.position.length).set(
          w.position,
        );
        if (w.index instanceof Uint32Array) {
          new Uint32Array(buf, ex.indexPtr(), ic).set(w.index);
        } else if (w.index) {
          new Uint16Array(buf, ex.indexPtr(), ic).set(w.index);
        }
        ex.begin();
        const t0 = performance.now();
        ex.weld(0, pc, 1e6);
        const t1 = performance.now();
        ex.pair(0, ic, w.dot);
        const t2 = performance.now();
        ex.finish();
        const t3 = performance.now();
        weld.push(t1 - t0);
        pair.push(t2 - t1);
        fin.push(t3 - t2);
      }
      console.log(
        `split ${files[v].replace(/^.*\//, "")} ${w.name}: weld ${med(weld).toFixed(1)} pair ${med(pair).toFixed(1)} finish ${med(fin).toFixed(1)}`,
      );
    }
  }
  process.exit(0);
}

// --- Timing ---
type Sample = { compute: number; copyIn: number; mem: number };
const cold: Sample[][][] = files.map(() => workloads.map(() => []));
const warm: Sample[][][] = files.map(() => workloads.map(() => []));
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < files.length; k++) {
    // Rotate the starting variant each round to spread drift.
    const v = (k + r) % files.length;
    for (let wi = 0; wi < workloads.length; wi++) {
      const w = workloads[wi];
      const t: StageTimings = { copyIn: 0, compute: 0, copyOut: 0 };
      gc();
      const ex = instantiate(modules[v]);
      computeEdgesWasm(ex, w.position, w.index, w.dot, 1e6, t);
      cold[v][wi].push({
        compute: t.compute,
        copyIn: t.copyIn,
        mem: ex.memoryBytes(),
      });
      // Warm = second run on the same fresh instance, so no instance-level
      // bias (memory placement) carries across samples.
      computeEdgesWasm(ex, w.position, w.index, w.dot, 1e6, t);
      warm[v][wi].push({ compute: t.compute, copyIn: t.copyIn, mem: 0 });
    }
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const rows: Record<string, unknown>[] = [];
for (let v = 0; v < files.length; v++) {
  for (let wi = 0; wi < workloads.length; wi++) {
    rows.push({
      variant: files[v].replace(/^.*\//, ""),
      workload: workloads[wi].name,
      coldCompute: +median(cold[v][wi].map((s) => s.compute)).toFixed(2),
      coldCopyIn: +median(cold[v][wi].map((s) => s.copyIn)).toFixed(2),
      warmCompute: +median(warm[v][wi].map((s) => s.compute)).toFixed(2),
      memMB: +(cold[v][wi][0].mem / 1048576).toFixed(0),
    });
  }
}
console.table(rows);
console.log(JSON.stringify(rows));
