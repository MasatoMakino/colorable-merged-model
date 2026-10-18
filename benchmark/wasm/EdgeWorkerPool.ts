import type {
  WorkerDoneMessage,
  WorkerInitMessage,
  WorkerReadyMessage,
  WorkerTaskMessage,
} from "./worker.js";

export interface EdgeWorkerPoolOptions {
  kind: "js" | "wasm";
  /** Upper bound of live workers; Infinity spawns one worker per pending task. */
  maxWorkers: number;
  workerUrl: string;
  wasmUrl?: string;
  /** Compile the module once on the main thread and post it to each worker. */
  sharedModule?: boolean;
  /**
   * "lpt" defers dispatch by one macrotask and sends the largest task first;
   * "fifo" dispatches in submission order immediately.
   */
  schedule?: "fifo" | "lpt";
  /** "clone": structured clone of the input; "slice": copy on main, then transfer. */
  transfer?: "clone" | "slice";
  /** Triangles per WASM call; 0 runs one call per construction. */
  chunk?: number;
  /** [positionCount, indexCount] each worker pre-grows and touches at init. */
  reserve?: [number, number] | null;
}

export interface EdgeTaskResult {
  position: Float32Array;
  workerIndex: number;
  copyIn: number;
  compute: number;
  copyOut: number;
  postMs: number;
  submittedAt: number;
  postedAt: number;
  receivedAt: number;
  startAt: number;
  finishedAt: number;
  resolvedAt: number;
  memoryBytes: number;
}

interface PendingTask {
  id: number;
  cost: number;
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
  thresholdDot: number;
  precision: number;
  submittedAt: number;
  resolve: (r: EdgeTaskResult) => void;
  reject: (e: unknown) => void;
}

interface PoolWorker {
  index: number;
  worker: Worker;
  spawnAt: number;
  readyAt: number;
  initMs: number;
  /** Last reported linear memory size; memory never shrinks. */
  memoryBytes: number;
  ready: Promise<void>;
  /** Resolves once the init message is posted; tasks are posted after it. */
  initPosted: Promise<void>;
  running: { task: PendingTask; postMs: number; postedAt: number } | null;
}

const now = () => performance.timeOrigin + performance.now();

/**
 * Bounded pool of edge workers. Each worker owns one WASM instance (or the
 * JS core), so the pool size bounds both startup cost and retained memory.
 * Results resolve per task; callers keep their own order by task identity.
 */
export class EdgeWorkerPool {
  readonly options: Required<EdgeWorkerPoolOptions>;
  readonly workers: PoolWorker[] = [];
  /** Main-thread time spent inside pool code (posting and receiving). */
  mainThreadMs = 0;
  private readonly idle: PoolWorker[] = [];
  private readonly queue: PendingTask[] = [];
  private modulePromise: Promise<WebAssembly.Module> | null = null;
  private dispatchScheduled = false;
  private nextId = 0;
  private readonly channel = new MessageChannel();

  constructor(options: EdgeWorkerPoolOptions) {
    this.options = {
      wasmUrl: "",
      sharedModule: true,
      schedule: "lpt",
      transfer: "slice",
      chunk: 0,
      reserve: null,
      ...options,
    };
    this.channel.port1.onmessage = () => {
      this.dispatchScheduled = false;
      this.dispatch();
    };
  }

  /** Spawn workers ahead of the first task and wait until they are ready. */
  async prewarm(count = this.options.maxWorkers): Promise<void> {
    while (this.workers.length < count) {
      this.idle.push(this.spawn());
    }
    await Promise.all(this.workers.map((w) => w.ready));
  }

  submit(
    position: Float32Array,
    index: Uint16Array | Uint32Array | null,
    thresholdDot: number,
    precision: number,
  ): Promise<EdgeTaskResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: this.nextId++,
        cost: index ? index.length : position.length / 3,
        position,
        index,
        thresholdDot,
        precision,
        submittedAt: now(),
        resolve,
        reject,
      });
      if (this.options.schedule === "fifo") {
        this.dispatch();
      } else if (!this.dispatchScheduled) {
        // All submissions of one batch land in the same macrotask; deferring
        // lets the largest-first ordering see the whole batch.
        this.dispatchScheduled = true;
        this.channel.port2.postMessage(null);
      }
    });
  }

  terminate(): void {
    for (const w of this.workers) w.worker.terminate();
    this.workers.length = 0;
    this.idle.length = 0;
    this.channel.port1.close();
  }

  private getModule(): Promise<WebAssembly.Module> {
    this.modulePromise ??= WebAssembly.compileStreaming(
      fetch(this.options.wasmUrl),
    );
    return this.modulePromise;
  }

  private spawn(): PoolWorker {
    const index = this.workers.length;
    const spawnAt = now();
    const worker = new Worker(this.options.workerUrl, { type: "module" });
    let markReady: () => void = () => {};
    const ready = new Promise<void>((r) => {
      markReady = r;
    });
    const pw: PoolWorker = {
      index,
      worker,
      spawnAt,
      readyAt: 0,
      initMs: 0,
      memoryBytes: 0,
      ready,
      initPosted: Promise.resolve(),
      running: null,
    };
    worker.onmessage = (
      e: MessageEvent<WorkerReadyMessage | WorkerDoneMessage>,
    ) => {
      const msg = e.data;
      if (msg.type === "ready") {
        pw.readyAt = msg.readyAt;
        pw.initMs = msg.initMs;
        markReady();
        return;
      }
      this.onDone(pw, msg);
    };
    worker.onerror = (e) => {
      const task = pw.running?.task;
      if (task) task.reject(e);
    };

    const { kind, sharedModule, wasmUrl, reserve } = this.options;
    if (kind === "wasm" && sharedModule) {
      pw.initPosted = this.getModule().then((module) => {
        const init: WorkerInitMessage = { type: "init", kind, module, reserve };
        worker.postMessage(init);
      });
    } else {
      const init: WorkerInitMessage = {
        type: "init",
        kind,
        wasmUrl: new URL(wasmUrl, location.href).href,
        reserve,
      };
      worker.postMessage(init);
    }
    this.workers.push(pw);
    return pw;
  }

  private dispatch(): void {
    const t0 = performance.now();
    if (this.options.schedule === "lpt") {
      this.queue.sort((a, b) => b.cost - a.cost || a.id - b.id);
    }
    while (this.queue.length > 0) {
      let pw = this.idle.pop();
      if (!pw && this.workers.length < this.options.maxWorkers) {
        pw = this.spawn();
      }
      if (!pw) break;
      const task = this.queue.shift() as PendingTask;
      this.post(pw, task);
    }
    this.mainThreadMs += performance.now() - t0;
  }

  private post(pw: PoolWorker, task: PendingTask): void {
    pw.running = { task, postMs: 0, postedAt: 0 };
    const send = () => {
      const t0 = performance.now();
      const postedAt = now();
      let position = task.position;
      let index = task.index;
      const transferList: Transferable[] = [];
      if (this.options.transfer === "slice") {
        position = position.slice();
        transferList.push(position.buffer);
        if (index) {
          index = index.slice();
          transferList.push(index.buffer);
        }
      }
      const msg: WorkerTaskMessage = {
        type: "task",
        id: task.id,
        position,
        index,
        thresholdDot: task.thresholdDot,
        precision: task.precision,
        chunk: this.options.chunk,
        postedAt,
      };
      pw.worker.postMessage(msg, transferList);
      const postMs = performance.now() - t0;
      if (pw.running) {
        pw.running.postMs = postMs;
        pw.running.postedAt = postedAt;
      }
      return postMs;
    };
    // Shared-module workers receive init asynchronously; the task message
    // must follow it. send() runs in a microtask, outside dispatch() timing.
    pw.initPosted.then(() => {
      this.mainThreadMs += send();
    });
  }

  private onDone(pw: PoolWorker, msg: WorkerDoneMessage): void {
    const t0 = performance.now();
    const running = pw.running;
    pw.running = null;
    pw.memoryBytes = msg.memoryBytes;
    this.idle.push(pw);
    if (running) {
      running.task.resolve({
        position: msg.position,
        workerIndex: pw.index,
        copyIn: msg.timings.copyIn,
        compute: msg.timings.compute,
        copyOut: msg.timings.copyOut,
        postMs: running.postMs,
        submittedAt: running.task.submittedAt,
        postedAt: running.postedAt,
        receivedAt: msg.receivedAt,
        startAt: msg.startAt,
        finishedAt: msg.finishedAt,
        resolvedAt: now(),
        memoryBytes: msg.memoryBytes,
      });
    }
    this.mainThreadMs += performance.now() - t0;
    if (this.queue.length > 0) this.dispatch();
  }
}
