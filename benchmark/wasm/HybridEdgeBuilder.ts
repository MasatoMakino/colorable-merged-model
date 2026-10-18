import type { EdgeWorkerPool } from "./EdgeWorkerPool.js";

export interface HybridTask {
  triangles: number;
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
  thresholdDot: number;
  /** Builds the edges synchronously on the main thread. */
  runOnMain: () => Float32Array;
}

export interface HybridOptions {
  pool: EdgeWorkerPool;
  /** Tasks with more triangles than this go to the pool; others run on main. */
  thresholdTriangles: number;
  /**
   * "batch": after posting the batch's large tasks, run all small tasks in one
   * synchronous block. "sliced": same order, but yield every `sliceMs`.
   * "immediate": run each small task on arrival (control: no overlap).
   */
  mainMode: "batch" | "sliced" | "immediate";
  sliceMs?: number;
  precision: number;
}

interface Entry {
  task: HybridTask;
  resolve: (out: Float32Array) => void;
  reject: (e: unknown) => void;
}

/**
 * Routes each construction to the main thread or a worker pool by size.
 * Submissions of one macrotask are collected so that every large task is
 * posted before the main thread starts on the small ones.
 */
export class HybridEdgeBuilder {
  readonly options: Required<HybridOptions>;
  /** Main-thread time spent on small tasks. */
  mainComputeMs = 0;
  /** Longest synchronous stretch of small-task work. */
  maxSyncMs = 0;
  mainTasks = 0;
  workerTasks = 0;
  private pending: Entry[] = [];
  private flushScheduled = false;
  private readonly channel = new MessageChannel();
  private yieldResolvers: (() => void)[] = [];

  constructor(options: HybridOptions) {
    this.options = { sliceMs: 8, ...options };
    this.channel.port1.onmessage = () => {
      const r = this.yieldResolvers.shift();
      if (r) r();
    };
  }

  submit(task: HybridTask): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      const entry = { task, resolve, reject };
      if (this.options.mainMode === "immediate") {
        this.route(entry);
        return;
      }
      this.pending.push(entry);
      if (!this.flushScheduled) {
        this.flushScheduled = true;
        void this.nextTick().then(() => this.flush());
      }
    });
  }

  dispose(): void {
    this.channel.port1.close();
  }

  private isLarge(task: HybridTask): boolean {
    return task.triangles > this.options.thresholdTriangles;
  }

  private toPool(entry: Entry): void {
    this.workerTasks++;
    const { task } = entry;
    this.options.pool
      .submit(
        task.position,
        task.index,
        task.thresholdDot,
        this.options.precision,
      )
      .then((r) => entry.resolve(r.position), entry.reject);
  }

  private runMain(entry: Entry): void {
    this.mainTasks++;
    try {
      entry.resolve(entry.task.runOnMain());
    } catch (e) {
      entry.reject(e);
    }
  }

  private route(entry: Entry): void {
    if (this.isLarge(entry.task)) {
      this.toPool(entry);
      return;
    }
    const s = performance.now();
    this.runMain(entry);
    const d = performance.now() - s;
    this.mainComputeMs += d;
    this.maxSyncMs = Math.max(this.maxSyncMs, d);
  }

  private nextTick(): Promise<void> {
    return new Promise((r) => {
      this.yieldResolvers.push(r);
      this.channel.port2.postMessage(null);
    });
  }

  private async flush(): Promise<void> {
    this.flushScheduled = false;
    const batch = this.pending;
    this.pending = [];
    const large = batch
      .filter((e) => this.isLarge(e.task))
      .sort((a, b) => b.task.triangles - a.task.triangles);
    for (const e of large) this.toPool(e);

    const small = batch.filter((e) => !this.isLarge(e.task));
    const sliced = this.options.mainMode === "sliced";
    let sliceStart = performance.now();
    for (const e of small) {
      const s = performance.now();
      this.runMain(e);
      const end = performance.now();
      this.mainComputeMs += end - s;
      if (sliced && end - sliceStart >= this.options.sliceMs) {
        this.maxSyncMs = Math.max(this.maxSyncMs, end - sliceStart);
        await this.nextTick();
        sliceStart = performance.now();
      }
    }
    this.maxSyncMs = Math.max(this.maxSyncMs, performance.now() - sliceStart);
  }
}
