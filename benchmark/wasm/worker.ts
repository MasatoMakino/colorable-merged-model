/// <reference lib="webworker" />
import { computeEdges } from "./edgesCore.js";
import {
  computeEdgesWasm,
  type EdgesWasmExports,
  type StageTimings,
} from "./wasmEdges.js";

export interface WorkerInitMessage {
  type: "init";
  kind: "js" | "wasm";
  module?: WebAssembly.Module;
  wasmUrl?: string;
  /** [positionCount, indexCount] to grow and touch linear memory for at init. */
  reserve?: [number, number] | null;
}

export interface WorkerTaskMessage {
  type: "task";
  id: number;
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
  thresholdDot: number;
  precision: number;
  chunk: number;
  postedAt: number;
}

export interface WorkerReadyMessage {
  type: "ready";
  initMs: number;
  readyAt: number;
}

export interface WorkerDoneMessage {
  type: "done";
  id: number;
  position: Float32Array;
  timings: StageTimings;
  receivedAt: number;
  startAt: number;
  finishedAt: number;
  memoryBytes: number;
}

declare const self: DedicatedWorkerGlobalScope;

// Absolute clock shared with the main thread (timeOrigin differs per thread).
const now = () => performance.timeOrigin + performance.now();

let ready: Promise<EdgesWasmExports | null> = Promise.resolve(null);

self.onmessage = (e: MessageEvent<WorkerInitMessage | WorkerTaskMessage>) => {
  const msg = e.data;
  if (msg.type === "init") {
    ready = init(msg);
    return;
  }
  void runTask(msg, now());
};

async function init(msg: WorkerInitMessage): Promise<EdgesWasmExports | null> {
  const t0 = performance.now();
  let ex: EdgesWasmExports | null = null;
  if (msg.kind === "wasm") {
    const module =
      msg.module ??
      (await WebAssembly.compileStreaming(fetch(msg.wasmUrl as string)));
    const instance = await WebAssembly.instantiate(module);
    ex = instance.exports as unknown as EdgesWasmExports;
    if (msg.reserve) {
      // First-touch page faults otherwise land inside the first large task.
      ex.prepare(msg.reserve[0], msg.reserve[1], 4);
      new Uint8Array(ex.memory.buffer).fill(0);
    }
  }
  const ready: WorkerReadyMessage = {
    type: "ready",
    initMs: performance.now() - t0,
    readyAt: now(),
  };
  self.postMessage(ready);
  return ex;
}

async function runTask(msg: WorkerTaskMessage, receivedAt: number) {
  const ex = await ready;
  const startAt = now();
  const timings: StageTimings = { copyIn: 0, compute: 0, copyOut: 0 };
  let out: Float32Array;
  if (ex) {
    out = computeEdgesWasm(
      ex,
      msg.position,
      msg.index,
      msg.thresholdDot,
      msg.precision,
      timings,
      msg.chunk,
    );
  } else {
    const t = performance.now();
    out = computeEdges(
      msg.position,
      msg.index,
      msg.thresholdDot,
      msg.precision,
    );
    timings.compute = performance.now() - t;
  }
  const done: WorkerDoneMessage = {
    type: "done",
    id: msg.id,
    position: out,
    timings,
    receivedAt,
    startAt,
    finishedAt: now(),
    memoryBytes: ex ? ex.memoryBytes() : 0,
  };
  self.postMessage(done, [out.buffer]);
}
