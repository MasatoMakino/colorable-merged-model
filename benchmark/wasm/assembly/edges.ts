// AssemblyScript port of the src/FastEdgesGeometry.ts Stage 4 algorithm.
// Every buffer lives in linear memory at addresses laid out by prepare();
// the host copies inputs to positionPtr()/indexPtr() and reads the result
// from outputPtr(). Bit-compatibility notes are inline where WASM semantics
// differ from JS.

let gPositionCount: i32 = 0;
let gIndexCount: i32 = 0;
let gIndexWidth: i32 = 0; // 0 = non-indexed, 2 = Uint16, 4 = Uint32
let gWeldCapacity: i32 = 0;
let gCapacity: i32 = 0;

let pPos: usize = 0;
let pIdx: usize = 0;
let pQx: usize = 0;
let pQy: usize = 0;
let pQz: usize = 0;
let pWelded: usize = 0;
let pWeldTable: usize = 0;
let pKeyA: usize = 0;
let pKeyB: usize = 0;
let pSlots: usize = 0;
// Slot records of 24 bytes, in insertion order: orig0 (u32), orig1 (u32),
// face normal nx/ny/nz (f32), alive (u8), padding. A match reads one record
// instead of alive, face, and three normal arrays. The normal is stored as
// f32 because the compare reads it as fround(stored).
let pRec: usize = 0;
let pOut: usize = 0;

@inline
function align16(p: usize): usize {
  return (p + 15) & ~(<usize>15);
}

/**
 * Lay out every buffer for one construction and grow memory when needed.
 * Memory only grows, so a worker retains its largest-seen footprint.
 */
export function prepare(
  positionCount: i32,
  indexCount: i32,
  indexWidth: i32,
  capacityFactor: f64,
): void {
  // Only the measured factors are accepted: at or below 1 a table can fill
  // and linear probing never reaches an empty cell.
  if (capacityFactor != 1.5 && capacityFactor != 2.0) unreachable();
  gPositionCount = positionCount;
  gIndexCount = indexCount;
  gIndexWidth = indexWidth;

  // Capacity is the next power of two of capacityFactor x the inserts, so the
  // load stays at or below 0.5 (factor 2) or 0.67 (factor 1.5). Against 2,
  // 1.5 halves the tables for counts between 2^k / 2 and 2^k / 1.5: manifold
  // meshes run faster (smaller fill and footprint), while input whose edges
  // never match runs slower at the higher load.
  let weldCapacity: i32 = 16;
  while (<f64>weldCapacity < <f64>positionCount * capacityFactor)
    weldCapacity <<= 1;
  let capacity: i32 = 16;
  while (<f64>capacity < <f64>indexCount * capacityFactor) capacity <<= 1;
  gWeldCapacity = weldCapacity;
  gCapacity = capacity;

  const pc = <usize>positionCount;
  const ic = <usize>indexCount;
  const fc = <usize>(indexCount / 3);

  let p = align16(__heap_base);
  pQx = p;
  p = align16(p + pc * 8);
  pQy = p;
  p = align16(p + pc * 8);
  pQz = p;
  p = align16(p + pc * 8);
  pPos = p;
  p = align16(p + pc * 12);
  pIdx = p;
  p = align16(p + ic * <usize>indexWidth);
  pWelded = p;
  p = align16(p + pc * 4);
  pWeldTable = p;
  p = align16(p + <usize>weldCapacity * 4);
  pKeyA = p;
  p = align16(p + <usize>capacity * 4);
  pKeyB = p;
  p = align16(p + <usize>capacity * 4);
  pSlots = p;
  p = align16(p + <usize>capacity * 4);
  pRec = p;
  p = align16(p + ic * 24);
  pOut = p;
  p = align16(p + ic * 24);

  const have = (<usize>memory.size()) << 16;
  if (p > have) {
    const pages = <i32>((p - have + 0xffff) >> 16);
    if (memory.grow(pages) < 0) unreachable();
  }
}

export function positionPtr(): usize {
  return pPos;
}

export function indexPtr(): usize {
  return pIdx;
}

export function outputPtr(): usize {
  return pOut;
}

export function memoryBytes(): i32 {
  return memory.size() << 16;
}

// JS Math.round: ties round toward +Infinity. f64.nearest rounds ties to
// even, which would change weld identity on exact .5 products.
@inline
function jsRound(x: f64): f64 {
  let r = Math.floor(x);
  if (x - r >= 0.5) r += 1.0;
  return r;
}

@inline
function loadIndex(i: i32): i32 {
  if (gIndexWidth == 4) return <i32>load<u32>(pIdx + ((<usize>i) << 2));
  if (gIndexWidth == 2) return <i32>load<u16>(pIdx + ((<usize>i) << 1));
  return i;
}

@inline
function px(v: i32): f64 {
  return <f64>load<f32>(pPos + <usize>v * 12);
}
@inline
function py(v: i32): f64 {
  return <f64>load<f32>(pPos + <usize>v * 12 + 4);
}
@inline
function pz(v: i32): f64 {
  return <f64>load<f32>(pPos + <usize>v * 12 + 8);
}

@inline
function welded(v: i32): i32 {
  return load<i32>(pWelded + ((<usize>v) << 2));
}
@inline
function slotAt(probe: i32): i32 {
  return load<i32>(pSlots + ((<usize>probe) << 2));
}
@inline
function keyA(probe: i32): u32 {
  return load<u32>(pKeyA + ((<usize>probe) << 2));
}
@inline
function keyB(probe: i32): u32 {
  return load<u32>(pKeyB + ((<usize>probe) << 2));
}

// Math.imul multipliers of src, as wrapped i32 values.
const M1: i32 = <i32>0x85ebca77;
const M2: i32 = <i32>0xc2b2ae3d;

let gWrite: i32 = 0;
let gSlotCount: i32 = 0;

@inline
function emit(ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64): void {
  const o = pOut + ((<usize>gWrite) << 2);
  store<f32>(o, <f32>ax);
  store<f32>(o + 4, <f32>ay);
  store<f32>(o + 8, <f32>az);
  store<f32>(o + 12, <f32>bx);
  store<f32>(o + 16, <f32>by);
  store<f32>(o + 20, <f32>bz);
  gWrite += 6;
}

// One directed edge (ia -> ib) of the current face. Mirrors one unrolled
// block of src; inlined three times per triangle.
@inline
function processEdge(
  ia: i32,
  ib: i32,
  ida: i32,
  idb: i32,
  ax: f64,
  ay: f64,
  az: f64,
  bx: f64,
  by: f64,
  bz: f64,
  nx: f64,
  ny: f64,
  nz: f64,
  mask: i32,
  thresholdDot: f64,
): void {
  let foundSlot: i32 = -1;
  let probe = ((idb * M1) ^ (ida * M2)) & mask;
  while (true) {
    const s = slotAt(probe);
    if (s == -1) break;
    if (s >= 0 && keyA(probe) == <u32>idb && keyB(probe) == <u32>ida) {
      foundSlot = s;
      store<i32>(pSlots + ((<usize>probe) << 2), -2);
      break;
    }
    probe = (probe + 1) & mask;
  }
  if (foundSlot >= 0) {
    const rec = pRec + <usize>foundSlot * 24;
    store<u8>(rec + 20, 0);
    // float64 (current) x fround(stored): same convention as src. Additions
    // are left-associated as in JS; no FMA is emitted.
    const dotProduct =
      nx * <f64>load<f32>(rec + 8) +
      ny * <f64>load<f32>(rec + 12) +
      nz * <f64>load<f32>(rec + 16);
    if (dotProduct <= thresholdDot) {
      emit(ax, ay, az, bx, by, bz);
    }
  } else {
    let target: i32 = -1;
    probe = ((ida * M1) ^ (idb * M2)) & mask;
    while (true) {
      const s = slotAt(probe);
      if (s == -1) {
        if (target == -1) target = probe;
        break;
      }
      if (s == -2) {
        if (target == -1) target = probe;
      } else if (keyA(probe) == <u32>ida && keyB(probe) == <u32>idb) {
        // duplicate directed edge (non-manifold): last one wins
        store<u8>(pRec + <usize>s * 24 + 20, 0);
        target = probe;
        break;
      }
      probe = (probe + 1) & mask;
    }
    const slot = gSlotCount++;
    const t = (<usize>target) << 2;
    store<u32>(pKeyA + t, <u32>ida);
    store<u32>(pKeyB + t, <u32>idb);
    store<i32>(pSlots + t, slot);
    const rec = pRec + <usize>slot * 24;
    store<u32>(rec, <u32>ia);
    store<u32>(rec + 4, <u32>ib);
    store<f32>(rec + 8, <f32>nx);
    store<f32>(rec + 12, <f32>ny);
    store<f32>(rec + 16, <f32>nz);
    store<u8>(rec + 20, 1);
  }
}

export function begin(): void {
  memory.fill(pWeldTable, 0xff, (<usize>gWeldCapacity) << 2);
  memory.fill(pSlots, 0xff, (<usize>gCapacity) << 2);
  gWrite = 0;
  gSlotCount = 0;
}

/** Weld vertices [from, to). Calls must cover 0..positionCount in order. */
export function weld(from: i32, to: i32, precision: f64): void {
  const weldMask = gWeldCapacity - 1;
  // --- Pass 1: weld vertices into canonical ids ---
  for (let v: i32 = from; v < to; v++) {
    const x = jsRound(px(v) * precision);
    const y = jsRound(py(v) * precision);
    const z = jsRound(pz(v) * precision);
    const vo = (<usize>v) << 3;
    store<f64>(pQx + vo, x);
    store<f64>(pQy + vo, y);
    store<f64>(pQz + vo, z);

    // Probe start only; any deterministic mapping keeps the output.
    // <i64> is a saturating truncation, then wraps like JS ToInt32.
    const xi = <u32>(<i64>x);
    const yi = <u32>(<i64>y);
    const zi = <u32>(<i64>z);
    const hx = ((xi & 0xfffffffe) << 13) ^ (((xi << 19) ^ xi) >>> 12);
    const hy = ((yi & 0xfffffff8) << 2) ^ (((yi << 25) ^ yi) >>> 4);
    const hz = ((zi & 0xfffffff0) << 3) ^ (((zi << 11) ^ zi) >>> 17);
    let probe = <i32>(hx ^ hy ^ hz) & weldMask;
    while (true) {
      const canonical = load<i32>(pWeldTable + ((<usize>probe) << 2));
      if (canonical == -1) {
        store<i32>(pWeldTable + ((<usize>probe) << 2), v);
        store<i32>(pWelded + ((<usize>v) << 2), v);
        break;
      }
      const co = (<usize>canonical) << 3;
      if (
        load<f64>(pQx + co) == x &&
        load<f64>(pQy + co) == y &&
        load<f64>(pQz + co) == z
      ) {
        store<i32>(pWelded + ((<usize>v) << 2), canonical);
        break;
      }
      probe = (probe + 1) & weldMask;
    }
  }
}

/**
 * Pair edges of index positions [from, to) (multiples of 3). Calls must
 * cover 0..indexCount in order, after every weld() call.
 */
export function pair(from: i32, to: i32, thresholdDot: f64): void {
  const mask = gCapacity - 1;
  // --- Pass 2: edge pairing ---
  for (let i: i32 = from; i < to; i += 3) {
    const i0 = loadIndex(i);
    const i1 = loadIndex(i + 1);
    const i2 = loadIndex(i + 2);

    const id0 = welded(i0);
    const id1 = welded(i1);
    const id2 = welded(i2);
    if (id0 == id1 || id1 == id2 || id2 == id0) continue;

    const x0 = px(i0),
      y0 = py(i0),
      z0 = pz(i0);
    const x1 = px(i1),
      y1 = py(i1),
      z1 = pz(i1);
    const x2 = px(i2),
      y2 = py(i2),
      z2 = pz(i2);

    const e1x = x1 - x0,
      e1y = y1 - y0,
      e1z = z1 - z0;
    const e2x = x2 - x0,
      e2y = y2 - y0,
      e2z = z2 - z0;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      const invLen = 1 / len;
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
    }

    processEdge(
      i0,
      i1,
      id0,
      id1,
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      nx,
      ny,
      nz,
      mask,
      thresholdDot,
    );
    processEdge(
      i1,
      i2,
      id1,
      id2,
      x1,
      y1,
      z1,
      x2,
      y2,
      z2,
      nx,
      ny,
      nz,
      mask,
      thresholdDot,
    );
    processEdge(
      i2,
      i0,
      id2,
      id0,
      x2,
      y2,
      z2,
      x0,
      y0,
      z0,
      nx,
      ny,
      nz,
      mask,
      thresholdDot,
    );
  }
}

/** Emit unmatched edges; returns the number of floats at outputPtr(). */
export function finish(): i32 {
  // --- Emit remaining unmatched edges in insertion order ---
  const slotCount = gSlotCount;
  for (let slot: i32 = 0; slot < slotCount; slot++) {
    const rec = pRec + <usize>slot * 24;
    if (load<u8>(rec + 20) == 0) continue;
    const a = <i32>load<u32>(rec);
    const b = <i32>load<u32>(rec + 4);
    emit(px(a), py(a), pz(a), px(b), py(b), pz(b));
  }

  return gWrite;
}

/**
 * Run one construction in a single call. The chunked begin/weld/pair/finish
 * exports produce the same output and measured the same speed.
 */
export function compute(thresholdDot: f64, precision: f64): i32 {
  begin();
  weld(0, gPositionCount, precision);
  pair(0, gIndexCount, thresholdDot);
  return finish();
}
