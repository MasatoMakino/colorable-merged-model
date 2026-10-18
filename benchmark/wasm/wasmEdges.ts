export interface EdgesWasmExports {
  memory: WebAssembly.Memory;
  prepare(
    positionCount: number,
    indexCount: number,
    indexWidth: number,
    capacityFactor: number,
  ): void;
  positionPtr(): number;
  indexPtr(): number;
  outputPtr(): number;
  memoryBytes(): number;
  compute(thresholdDot: number, precision: number): number;
  begin(): void;
  weld(from: number, to: number, precision: number): void;
  pair(from: number, to: number, thresholdDot: number): void;
  finish(): number;
}

/** Matches the default of `FastEdgesGeometry` `options.tableCapacityFactor`. */
export const DEFAULT_CAPACITY_FACTOR = 2;

export interface StageTimings {
  copyIn: number;
  compute: number;
  copyOut: number;
}

/**
 * Run one construction inside a WASM instance. Both directions copy between
 * JS-owned typed arrays and linear memory; the copies are timed separately
 * from the computation.
 */
export function computeEdgesWasm(
  ex: EdgesWasmExports,
  position: Float32Array,
  index: Uint16Array | Uint32Array | null,
  thresholdDot: number,
  precision: number,
  timings?: StageTimings,
  /** Triangles per call; 0 runs the whole construction in one call. */
  chunk = 0,
  /** Hash-table capacity factor, 1.5 or 2. */
  capacityFactor = DEFAULT_CAPACITY_FACTOR,
): Float32Array {
  const positionCount = (position.length / 3) | 0;
  const indexCount = index ? index.length : positionCount;
  const t0 = performance.now();
  ex.prepare(
    positionCount,
    indexCount,
    index ? index.BYTES_PER_ELEMENT : 0,
    capacityFactor,
  );
  // prepare() may grow memory, which detaches earlier views of the buffer.
  const buffer = ex.memory.buffer;
  new Float32Array(buffer, ex.positionPtr(), position.length).set(position);
  if (index instanceof Uint32Array) {
    new Uint32Array(buffer, ex.indexPtr(), index.length).set(index);
  } else if (index) {
    new Uint16Array(buffer, ex.indexPtr(), index.length).set(index);
  }
  const t1 = performance.now();
  let count: number;
  if (chunk > 0) {
    ex.begin();
    for (let v = 0; v < positionCount; v += chunk) {
      ex.weld(v, Math.min(v + chunk, positionCount), precision);
    }
    const step = chunk * 3;
    for (let i = 0; i < indexCount; i += step) {
      ex.pair(i, Math.min(i + step, indexCount), thresholdDot);
    }
    count = ex.finish();
  } else {
    count = ex.compute(thresholdDot, precision);
  }
  const t2 = performance.now();
  const out = new Float32Array(ex.memory.buffer, ex.outputPtr(), count).slice();
  const t3 = performance.now();
  if (timings) {
    timings.copyIn = t1 - t0;
    timings.compute = t2 - t1;
    timings.copyOut = t3 - t2;
  }
  return out;
}
