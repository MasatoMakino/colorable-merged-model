// One benchmark condition per page load. The controller page opens this page
// in a fresh iframe per run so that every "cold" number starts with cold JIT,
// no workers, and no compiled WASM module.
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  Mesh,
  SphereGeometry,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FastEdgesGeometry } from "../../src/FastEdgesGeometry.js";
import { type EdgeTaskResult, EdgeWorkerPool } from "./EdgeWorkerPool.js";
import { HybridEdgeBuilder } from "./HybridEdgeBuilder.js";
import {
  computeEdgesWasm,
  DEFAULT_CAPACITY_FACTOR,
  type EdgesWasmExports,
  type StageTimings,
} from "./wasmEdges.js";

interface Task {
  name: string;
  geometry: BufferGeometry;
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
  threshold: number;
  thresholdDot: number;
}

const PRECISION = 1e6;
const WASM_URL =
  new URLSearchParams(location.search).get("wasm") ?? "edges.wasm";
const WORKER_URL = "worker.js";
const params = new URLSearchParams(location.search);
const impl = params.get("impl") ?? "A";
const workload = params.get("workload") ?? "real";
const start = params.get("start") ?? "cold";
const warmRuns = Number(params.get("warmRuns") ?? 3);
const chunk = Number(params.get("chunk") ?? 0);
const hc = navigator.hardwareConcurrency;

function resolveWorkers(spec: string | null, taskCount: number): number {
  if (spec === "all") return taskCount;
  if (spec === "hc") return hc;
  if (spec === "hc-1") return Math.max(1, hc - 1);
  return Number(spec ?? 4);
}

// --- Workloads ----------------------------------------------------------

/**
 * Real-data description, kept beside the assets in the git-ignored
 * `_local/` directory so that no dataset names enter the repository.
 */
interface LocalDataset {
  /** GLB file names under `_local/`. */
  files: string[];
  /** Middle tokens of `{prefix}_{category}_{id}` mesh names that get edges. */
  categories: string[];
  /** Categories that use `fineThreshold` instead of `threshold`. */
  fineCategories: string[];
  threshold: number;
  fineThreshold: number;
}

function toTask(
  name: string,
  geometry: BufferGeometry,
  threshold: number,
): Task {
  const attr = geometry.getAttribute("position");
  if (
    (attr as { isInterleavedBufferAttribute?: boolean })
      .isInterleavedBufferAttribute ||
    attr.normalized ||
    !(attr.array instanceof Float32Array)
  ) {
    throw new Error(`unsupported position layout: ${name}`);
  }
  return {
    name,
    geometry,
    position: attr.array,
    index: (geometry.getIndex()?.array ?? null) as
      | Uint16Array
      | Uint32Array
      | null,
    threshold,
    thresholdDot: Math.cos(MathUtils.DEG2RAD * threshold),
  };
}

async function loadReal(): Promise<Task[]> {
  const dataset: LocalDataset = await (
    await fetch("../_local/dataset.json")
  ).json();
  const categories = new Set(dataset.categories);
  const fine = new Set(dataset.fineCategories);
  const draco = new DRACOLoader().setDecoderPath("../_local/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const tasks: Task[] = [];
  for (const file of dataset.files) {
    const gltf = await loader.loadAsync(`../_local/${file}`);
    gltf.scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const match = obj.name.match(/^[^_]+_([^_]+)_\d+$/);
      if (!match || !categories.has(match[1])) return;
      const threshold = fine.has(match[1])
        ? dataset.fineThreshold
        : dataset.threshold;
      tasks.push(toTask(obj.name, obj.geometry, threshold));
    });
  }
  // Release the Draco decoder workers so they do not share the CPU.
  draco.dispose();
  return tasks;
}

function loadSynthetic(kind: string): Task[] {
  if (kind === "boxes1000") {
    const tasks: Task[] = [];
    for (let i = 0; i < 1000; i++) {
      const g = new BoxGeometry(1, 1, 1);
      g.translate(i * 2, 0, 0);
      tasks.push(toTask(`box_${i}`, g, 7));
    }
    return tasks;
  }
  if (kind === "sphere") {
    return [toTask("sphere", new SphereGeometry(1, 512, 512), 1)];
  }
  if (kind === "mixed") {
    // 100 subdivided boxes of 2k-8k triangles (about 460k in total) plus one
    // 523k-triangle sphere: the small set costs about as much on the main
    // thread as the sphere does on a worker.
    const tasks: Task[] = [
      toTask("sphere", new SphereGeometry(1, 512, 512), 1),
    ];
    for (let i = 0; i < 100; i++) {
      const s = 13 + (i % 14);
      const g = new BoxGeometry(1, 1, 1, s, s, s);
      g.translate(i * 2, 0, 0);
      tasks.push(toTask(`box_${i}`, g, 7));
    }
    return tasks;
  }
  throw new Error(`unknown workload ${kind}`);
}

// --- Main-thread observation ------------------------------------------

class MainThreadProbe {
  longTasks: number[] = [];
  maxFrameGap = 0;
  private observer: PerformanceObserver | null = null;
  private rafId = 0;
  private last = 0;

  start(): void {
    this.longTasks = [];
    this.maxFrameGap = 0;
    this.observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) this.longTasks.push(e.duration);
    });
    this.observer.observe({ type: "longtask", buffered: false });
    this.last = performance.now();
    const loop = (t: number) => {
      this.maxFrameGap = Math.max(this.maxFrameGap, t - this.last);
      this.last = t;
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** Waits one more frame so the gap that spans the run end is recorded. */
  async stop(): Promise<void> {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    cancelAnimationFrame(this.rafId);
    await new Promise((r) => setTimeout(r, 0));
    for (const e of this.observer?.takeRecords() ?? []) {
      this.longTasks.push(e.duration);
    }
    this.observer?.disconnect();
  }
}

// --- Implementations -------------------------------------------------

interface RunResult {
  wallMs: number;
  mainThreadMs: number;
  outputs: Float32Array[];
  sumCopyIn: number;
  sumCompute: number;
  sumCopyOut: number;
  sumPostMs: number;
  sumTransitMs: number;
  maxTaskCompute: number;
  peakMemoryBytes: number;
  totalMemoryBytes: number;
  hybrid?: {
    mainTasks: number;
    workerTasks: number;
    maxSyncMs: number;
    mainComputeMs: number;
  };
  workersSpawned: number;
  startupMs: number;
  maxWorkerInitMs: number;
}

function wrap(out: Float32Array): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(out, 3));
  return g;
}

function runA(tasks: Task[]): RunResult {
  const t0 = performance.now();
  const outputs: Float32Array[] = [];
  let maxTask = 0;
  for (const t of tasks) {
    const s = performance.now();
    const g = new FastEdgesGeometry(t.geometry, t.threshold);
    maxTask = Math.max(maxTask, performance.now() - s);
    outputs.push(g.getAttribute("position").array as Float32Array);
  }
  const wall = performance.now() - t0;
  return {
    wallMs: wall,
    mainThreadMs: wall,
    outputs,
    sumCopyIn: 0,
    sumCompute: wall,
    sumCopyOut: 0,
    sumPostMs: 0,
    sumTransitMs: 0,
    maxTaskCompute: maxTask,
    peakMemoryBytes: 0,
    totalMemoryBytes: 0,
    workersSpawned: 0,
    startupMs: 0,
    maxWorkerInitMs: 0,
  };
}

async function instantiateWasm(): Promise<EdgesWasmExports> {
  const module = await WebAssembly.compileStreaming(fetch(WASM_URL));
  const instance = await WebAssembly.instantiate(module);
  return instance.exports as unknown as EdgesWasmExports;
}

function runB(
  tasks: Task[],
  ex: EdgesWasmExports,
  startupMs: number,
): RunResult {
  const t0 = performance.now();
  const outputs: Float32Array[] = [];
  const tm: StageTimings = { copyIn: 0, compute: 0, copyOut: 0 };
  let sumIn = 0;
  let sumCompute = 0;
  let sumOut = 0;
  let maxTask = 0;
  for (const t of tasks) {
    const out = computeEdgesWasm(
      ex,
      t.position,
      t.index,
      t.thresholdDot,
      PRECISION,
      tm,
      chunk,
    );
    wrap(out);
    outputs.push(out);
    sumIn += tm.copyIn;
    sumCompute += tm.compute;
    sumOut += tm.copyOut;
    maxTask = Math.max(maxTask, tm.compute);
  }
  const wall = performance.now() - t0;
  return {
    wallMs: wall + startupMs,
    mainThreadMs: wall,
    outputs,
    sumCopyIn: sumIn,
    sumCompute,
    sumCopyOut: sumOut,
    sumPostMs: 0,
    sumTransitMs: 0,
    maxTaskCompute: maxTask,
    peakMemoryBytes: ex.memoryBytes(),
    totalMemoryBytes: ex.memoryBytes(),
    workersSpawned: 0,
    startupMs,
    maxWorkerInitMs: 0,
  };
}

async function runPool(
  tasks: Task[],
  pool: EdgeWorkerPool,
): Promise<RunResult> {
  const mainBefore = pool.mainThreadMs;
  const spawnedBefore = pool.workers.length;
  const t0 = performance.now();
  const t0Abs = performance.timeOrigin + t0;
  let wrapMs = 0;
  // Promise.all over submissions mirrors an application that adds every
  // mesh concurrently.
  const results: EdgeTaskResult[] = await Promise.all(
    tasks.map((t) =>
      pool.submit(t.position, t.index, t.thresholdDot, PRECISION).then((r) => {
        const s = performance.now();
        wrap(r.position);
        wrapMs += performance.now() - s;
        return r;
      }),
    ),
  );
  const wall = performance.now() - t0;
  const newWorkers = pool.workers.slice(spawnedBefore);
  const startupEnd = newWorkers.length
    ? Math.max(...newWorkers.map((w) => w.readyAt)) - t0Abs
    : 0;
  return {
    wallMs: wall,
    mainThreadMs: pool.mainThreadMs - mainBefore + wrapMs,
    outputs: results.map((r) => r.position),
    sumCopyIn: results.reduce((a, r) => a + r.copyIn, 0),
    sumCompute: results.reduce((a, r) => a + r.compute, 0),
    sumCopyOut: results.reduce((a, r) => a + r.copyOut, 0),
    sumPostMs: results.reduce((a, r) => a + r.postMs, 0),
    sumTransitMs: results.reduce((a, r) => a + (r.receivedAt - r.postedAt), 0),
    maxTaskCompute: Math.max(...results.map((r) => r.compute)),
    peakMemoryBytes: Math.max(...results.map((r) => r.memoryBytes)),
    totalMemoryBytes: pool.workers.reduce((a, w) => a + w.memoryBytes, 0),
    workersSpawned: pool.workers.length,
    startupMs: startupEnd,
    maxWorkerInitMs: Math.max(0, ...pool.workers.map((w) => w.initMs)),
  };
}

function triangles(t: Task): number {
  return (t.index ? t.index.length : t.position.length / 3) / 3;
}

function makeHybrid(
  pool: EdgeWorkerPool,
  thresholdTriangles: number,
  mainMode: "batch" | "sliced" | "immediate",
): HybridEdgeBuilder {
  return new HybridEdgeBuilder({
    pool,
    thresholdTriangles,
    mainMode,
    sliceMs: Number(params.get("sliceMs") ?? 8),
    precision: PRECISION,
  });
}

async function runHybrid(
  tasks: Task[],
  pool: EdgeWorkerPool,
  builder: HybridEdgeBuilder,
): Promise<RunResult> {
  const mainBefore = pool.mainThreadMs;
  const t0 = performance.now();
  let wrapMs = 0;
  const promises = tasks.map((t) =>
    builder
      .submit({
        triangles: triangles(t),
        position: t.position,
        index: t.index,
        thresholdDot: t.thresholdDot,
        runOnMain: () =>
          new FastEdgesGeometry(t.geometry, t.threshold).getAttribute(
            "position",
          ).array as Float32Array,
      })
      .then((out) => {
        const s = performance.now();
        wrap(out);
        wrapMs += performance.now() - s;
        return out;
      }),
  );
  // In "immediate" mode, this loop is the synchronous block of main work.
  const submitMs = performance.now() - t0;
  const outputs = await Promise.all(promises);
  const wall = performance.now() - t0;
  return {
    wallMs: wall,
    mainThreadMs:
      pool.mainThreadMs - mainBefore + wrapMs + builder.mainComputeMs,
    outputs,
    sumCopyIn: 0,
    sumCompute: builder.mainComputeMs,
    sumCopyOut: 0,
    sumPostMs: 0,
    sumTransitMs: 0,
    maxTaskCompute: 0,
    peakMemoryBytes: Math.max(0, ...pool.workers.map((w) => w.memoryBytes)),
    totalMemoryBytes: pool.workers.reduce((a, w) => a + w.memoryBytes, 0),
    workersSpawned: pool.workers.length,
    startupMs: 0,
    maxWorkerInitMs: Math.max(0, ...pool.workers.map((w) => w.initMs)),
    hybrid: {
      mainTasks: builder.mainTasks,
      workerTasks: builder.workerTasks,
      maxSyncMs: Math.max(builder.maxSyncMs, submitMs),
      mainComputeMs: builder.mainComputeMs,
    },
  };
}

// --- Verification ------------------------------------------------------

function sameBits(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  const ua = new Uint32Array(a.buffer, a.byteOffset, a.length);
  const ub = new Uint32Array(b.buffer, b.byteOffset, b.length);
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
  return true;
}

async function verify(tasks: Task[]) {
  const ref = runA(tasks).outputs;
  const ex = await instantiateWasm();
  const b = runB(tasks, ex, 0).outputs;
  const report: Record<string, number> = {};
  const check = (label: string, outs: Float32Array[]) => {
    report[label] = outs.filter((o, i) => !sameBits(o, ref[i])).length;
  };
  check("B", b);
  check(
    "B-chunk",
    tasks.map((t) =>
      computeEdgesWasm(
        ex,
        t.position,
        t.index,
        t.thresholdDot,
        PRECISION,
        undefined,
        4096,
      ),
    ),
  );
  for (const kind of ["js", "wasm"] as const) {
    for (const schedule of ["lpt", "fifo"] as const) {
      const pool = new EdgeWorkerPool({
        kind,
        maxWorkers: 4,
        workerUrl: WORKER_URL,
        wasmUrl: WASM_URL,
        schedule,
      });
      check(`${kind}-${schedule}`, (await runPool(tasks, pool)).outputs);
      pool.terminate();
    }
  }
  for (const mode of ["batch", "sliced", "immediate"] as const) {
    const pool = new EdgeWorkerPool({
      kind: "wasm",
      maxWorkers: 2,
      workerUrl: WORKER_URL,
      wasmUrl: WASM_URL,
      schedule: "fifo",
      sharedModule: false,
    });
    const builder = makeHybrid(pool, 1024, mode);
    check(`hybrid-${mode}`, (await runHybrid(tasks, pool, builder)).outputs);
    builder.dispose();
    pool.terminate();
  }
  return {
    tasks: tasks.length,
    segments: ref.reduce((a, o) => a + o.length / 6, 0),
    mismatches: report,
  };
}

// --- Entry -------------------------------------------------------------

function makePool(
  maxWorkers: number,
  reserve: [number, number] | null,
): EdgeWorkerPool {
  return new EdgeWorkerPool({
    kind: impl === "C" ? "js" : "wasm",
    maxWorkers,
    workerUrl: WORKER_URL,
    wasmUrl: WASM_URL,
    sharedModule: params.get("module") !== "worker",
    schedule: params.get("sched") === "fifo" ? "fifo" : "lpt",
    transfer: params.get("xfer") === "clone" ? "clone" : "slice",
    chunk,
    reserve,
  });
}

function summarize(r: RunResult, probe: MainThreadProbe) {
  const { outputs, ...rest } = r;
  return {
    ...rest,
    segments: outputs.reduce((a, o) => a + o.length / 6, 0),
    longTaskMax: Math.max(0, ...probe.longTasks),
    longTaskSum: probe.longTasks.reduce((a, b) => a + b, 0),
    maxFrameGap: probe.maxFrameGap,
  };
}

async function main() {
  // start=concurrent: spawn and prewarm the pool while assets load. The
  // reserve size comes from a configured hint, since meshes are not loaded.
  let concurrent: { pool: EdgeWorkerPool; prewarmMs: number } | null = null;
  let concurrentReady: Promise<void> | null = null;
  if (start === "concurrent" && (impl === "C" || impl === "D")) {
    const hint = params.get("reserveDims");
    const pool = makePool(
      resolveWorkers(params.get("workers"), 0),
      hint ? (hint.split(",").map(Number) as [number, number]) : null,
    );
    const s = performance.now();
    concurrent = { pool, prewarmMs: 0 };
    const c = concurrent;
    concurrentReady = pool.prewarm().then(() => {
      c.prewarmMs = performance.now() - s;
    });
  }
  const loadStart = performance.now();
  const tasks =
    workload === "real" ? await loadReal() : loadSynthetic(workload);
  const loadMs = performance.now() - loadStart;
  await concurrentReady;
  // Let decoder teardown and page load settle before measuring.
  await new Promise((r) => setTimeout(r, 300));

  if (params.get("verify") === "1") {
    return { verify: await verify(tasks) };
  }

  const probe = new MainThreadProbe();
  let prewarmMs = 0;
  const runs: ReturnType<typeof summarize>[] = [];
  const taskInfo = {
    count: tasks.length,
    triangles: tasks.reduce(
      (a, t) => a + (t.index ? t.index.length : t.position.length / 3) / 3,
      0,
    ),
    maxTriangles: Math.max(
      ...tasks.map(
        (t) => (t.index ? t.index.length : t.position.length / 3) / 3,
      ),
    ),
  };

  if (impl === "A") {
    for (let i = 0; i <= warmRuns; i++) {
      probe.start();
      const r = runA(tasks);
      await probe.stop();
      runs.push(summarize(r, probe));
    }
  } else if (impl === "B") {
    let ex: EdgesWasmExports;
    let startupMs = 0;
    if (start === "prewarm") {
      ex = await instantiateWasm();
    } else {
      const s = performance.now();
      ex = await instantiateWasm();
      startupMs = performance.now() - s;
    }
    // Diagnostics for the cold-run penalty, both untimed:
    // pretouch writes every page the largest task will use; warmup runs a
    // small mesh repeatedly so V8 can tier the module up beforehand.
    if (params.get("pretouch") === "1") {
      const big = tasks.reduce((a, t) =>
        t.position.length > a.position.length ? t : a,
      );
      ex.prepare(
        big.position.length / 3,
        big.index ? big.index.length : big.position.length / 3,
        4,
        DEFAULT_CAPACITY_FACTOR,
      );
      new Uint8Array(ex.memory.buffer).fill(0);
    }
    if (params.get("warmup") === "1") {
      const small = toTask("warmup", new BoxGeometry(1, 1, 1, 16, 16, 16), 7);
      for (let i = 0; i < 200; i++) {
        computeEdgesWasm(
          ex,
          small.position,
          small.index,
          small.thresholdDot,
          PRECISION,
        );
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    for (let i = 0; i <= warmRuns; i++) {
      probe.start();
      const r = runB(tasks, ex, i === 0 ? startupMs : 0);
      await probe.stop();
      runs.push(summarize(r, probe));
    }
  } else if (impl === "H") {
    // Hybrid: direct dispatch (FIFO) so the builder controls the order, and
    // per-worker compilation so dispatch never waits on the main thread.
    const pool = new EdgeWorkerPool({
      kind: "wasm",
      maxWorkers: Number(params.get("workers") ?? 2),
      workerUrl: WORKER_URL,
      wasmUrl: WASM_URL,
      schedule: "fifo",
      sharedModule: params.get("module") === "shared",
    });
    const thrParam = params.get("thr") ?? "1024";
    const thr =
      thrParam === "inf" ? Number.POSITIVE_INFINITY : Number(thrParam);
    const mode = (params.get("mode") ?? "batch") as
      | "batch"
      | "sliced"
      | "immediate";
    if (start === "prewarm") {
      const s = performance.now();
      await pool.prewarm();
      prewarmMs = performance.now() - s;
    }
    for (let i = 0; i <= warmRuns; i++) {
      const builder = makeHybrid(pool, thr, mode);
      probe.start();
      const r = await runHybrid(tasks, pool, builder);
      await probe.stop();
      runs.push(summarize(r, probe));
      builder.dispose();
    }
    pool.terminate();
  } else {
    let reserve: [number, number] | null = null;
    if (params.get("reserve") === "1") {
      const big = tasks.reduce((a, t) =>
        t.position.length > a.position.length ? t : a,
      );
      reserve = [
        big.position.length / 3,
        big.index ? big.index.length : big.position.length / 3,
      ];
    }
    const pool =
      concurrent?.pool ??
      makePool(resolveWorkers(params.get("workers"), tasks.length), reserve);
    if (concurrent) {
      prewarmMs = concurrent.prewarmMs;
    } else if (start === "prewarm") {
      const s = performance.now();
      await pool.prewarm();
      prewarmMs = performance.now() - s;
    }
    for (let i = 0; i <= warmRuns; i++) {
      probe.start();
      const r = await runPool(tasks, pool);
      await probe.stop();
      runs.push(summarize(r, probe));
    }
    pool.terminate();
  }
  return { hc, taskInfo, loadMs, prewarmMs, runs };
}

main().then(
  (result) => {
    const payload = { params: Object.fromEntries(params), ...result };
    (window as unknown as { __result: unknown }).__result = payload;
    window.parent?.postMessage({ type: "bench-result", payload }, "*");
  },
  (error) => {
    const payload = {
      params: Object.fromEntries(params),
      error: String(error),
    };
    (window as unknown as { __result: unknown }).__result = payload;
    window.parent?.postMessage({ type: "bench-result", payload }, "*");
  },
);
