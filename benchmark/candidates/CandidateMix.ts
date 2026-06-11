import { BufferGeometry, Float32BufferAttribute, MathUtils } from "three";

/**
 * CandidateMix: the production-shaped composition selected by the
 * measurement rounds. Kept as an independent candidate (NOT applied to
 * src/FastEdgesGeometry.ts) by user direction.
 *
 * Composition:
 * - Algorithm: Candidate E at every size — vertex-weld pre-pass with exact
 *   integer pair keys (collision-free; the `seed` option becomes a no-op),
 *   unrolled 3-edge loop, face normals stored once per face.
 * - Buffer strategy, gated by size (threshold sweep, benchmark/threshold.bench.ts):
 *   - indexCount and positionCount <= 2^18: module-level grow-only scratch
 *     arena (Candidate I). Gains: 5.2x on the per-source path (Box x1000),
 *     1.1-1.15x up to ~150k indexCount. Retained scratch is bounded to
 *     roughly 30MB worst case by the gate.
 *   - above the gate: fresh allocation (Candidate E). The sweep showed
 *     parity (0.97-1.24x) there, so the gate exists to bound memory
 *     retention, not to win speed.
 * - Interleaved or normalized position attributes are materialized into a
 *   packed Float64Array once (O(n)), then processed by the same hot loop.
 *
 * Output contract: identical edge set and segment order as the current
 * FastEdgesGeometry on collision-free inputs; on inputs where the current
 * implementation suffers 32-bit hash collisions, this class matches three.js
 * EdgesGeometry instead (i.e. it is strictly more accurate).
 * The mixed-precision dot product (`float64 current x fround(stored)`) is
 * preserved for bit-compatible threshold-boundary decisions.
 *
 * Not thread-safe: shared scratch arena (same caveat as the current
 * implementation's static arrays).
 */

const SCRATCH_MAX_COUNT = 262144; // 2^18, from the threshold sweep

let sWelded = new Int32Array(0);
let sQx = new Float64Array(0);
let sQy = new Float64Array(0);
let sQz = new Float64Array(0);
let sWeldTable = new Int32Array(0);
let sTableKeyA = new Uint32Array(0);
let sTableKeyB = new Uint32Array(0);
let sTableSlots = new Int32Array(0);
let sOrig0 = new Uint32Array(0);
let sOrig1 = new Uint32Array(0);
let sFace = new Uint32Array(0);
let sAlive = new Uint8Array(0);
let sFaceNX = new Float64Array(0);
let sFaceNY = new Float64Array(0);
let sFaceNZ = new Float64Array(0);
let sVertexBuffer = new Float32Array(0);

export class CandidateMix extends BufferGeometry {
  readonly type = "EdgesGeometry";
  parameters: { geometry: BufferGeometry | null; thresholdAngle: number };

  constructor(
    geometry: BufferGeometry | null = null,
    thresholdAngle = 1,
    options?: { seed?: number; precisionPoints?: number },
  ) {
    super();

    this.parameters = { geometry, thresholdAngle };

    if (geometry === null) return;

    const precisionPoints = options?.precisionPoints ?? 6;
    const precision = 10 ** precisionPoints;
    const thresholdDot = Math.cos(MathUtils.DEG2RAD * thresholdAngle);

    const indexAttr = geometry.getIndex();
    const positionAttr = geometry.getAttribute("position");
    const indexCount = indexAttr ? indexAttr.count : positionAttr.count;
    const positionCount = positionAttr.count;

    const index = indexAttr ? indexAttr.array : null;

    // Interleaved or normalized attributes cannot be read through .array
    // directly; materialize a packed copy once and share the hot loop.
    let position: ArrayLike<number>;
    const isInterleaved =
      (positionAttr as { isInterleavedBufferAttribute?: boolean })
        .isInterleavedBufferAttribute === true;
    if (isInterleaved || positionAttr.normalized) {
      const packed = new Float64Array(positionCount * 3);
      for (let v = 0; v < positionCount; v++) {
        packed[v * 3] = positionAttr.getX(v);
        packed[v * 3 + 1] = positionAttr.getY(v);
        packed[v * 3 + 2] = positionAttr.getZ(v);
      }
      position = packed;
    } else {
      position = positionAttr.array;
    }

    // --- Acquire working buffers (arena below the gate, fresh above) ------
    let weldCapacity = 16;
    while (weldCapacity < positionCount * 2) weldCapacity <<= 1;
    const weldMask = weldCapacity - 1;

    const maxEdges = indexCount;
    let capacity = 16;
    while (capacity < maxEdges * 2) capacity <<= 1;
    const mask = capacity - 1;

    const faceCount = (indexCount / 3) | 0;

    const useScratch =
      indexCount <= SCRATCH_MAX_COUNT && positionCount <= SCRATCH_MAX_COUNT;

    let welded: Int32Array;
    let qx: Float64Array;
    let qy: Float64Array;
    let qz: Float64Array;
    let weldTable: Int32Array;
    let tableKeyA: Uint32Array;
    let tableKeyB: Uint32Array;
    let tableSlots: Int32Array;
    let edgeOrig0: Uint32Array;
    let edgeOrig1: Uint32Array;
    let edgeFace: Uint32Array;
    let edgeAlive: Uint8Array;
    let faceNX: Float64Array;
    let faceNY: Float64Array;
    let faceNZ: Float64Array;
    let vertexBuffer: Float32Array;

    if (useScratch) {
      if (sWelded.length < positionCount)
        sWelded = new Int32Array(positionCount);
      if (sQx.length < positionCount) sQx = new Float64Array(positionCount);
      if (sQy.length < positionCount) sQy = new Float64Array(positionCount);
      if (sQz.length < positionCount) sQz = new Float64Array(positionCount);
      if (sWeldTable.length < weldCapacity)
        sWeldTable = new Int32Array(weldCapacity);
      if (sTableKeyA.length < capacity) sTableKeyA = new Uint32Array(capacity);
      if (sTableKeyB.length < capacity) sTableKeyB = new Uint32Array(capacity);
      if (sTableSlots.length < capacity) sTableSlots = new Int32Array(capacity);
      if (sOrig0.length < maxEdges) sOrig0 = new Uint32Array(maxEdges);
      if (sOrig1.length < maxEdges) sOrig1 = new Uint32Array(maxEdges);
      if (sFace.length < maxEdges) sFace = new Uint32Array(maxEdges);
      if (sAlive.length < maxEdges) sAlive = new Uint8Array(maxEdges);
      if (sFaceNX.length < faceCount) sFaceNX = new Float64Array(faceCount);
      if (sFaceNY.length < faceCount) sFaceNY = new Float64Array(faceCount);
      if (sFaceNZ.length < faceCount) sFaceNZ = new Float64Array(faceCount);
      if (sVertexBuffer.length < indexCount * 2 * 3)
        sVertexBuffer = new Float32Array(indexCount * 2 * 3);

      welded = sWelded;
      qx = sQx;
      qy = sQy;
      qz = sQz;
      weldTable = sWeldTable;
      tableKeyA = sTableKeyA;
      tableKeyB = sTableKeyB;
      tableSlots = sTableSlots;
      edgeOrig0 = sOrig0;
      edgeOrig1 = sOrig1;
      edgeFace = sFace;
      edgeAlive = sAlive;
      faceNX = sFaceNX;
      faceNY = sFaceNY;
      faceNZ = sFaceNZ;
      vertexBuffer = sVertexBuffer;

      // Only the table regions carry state between runs
      weldTable.fill(-1, 0, weldCapacity);
      tableSlots.fill(-1, 0, capacity);
    } else {
      welded = new Int32Array(positionCount);
      qx = new Float64Array(positionCount);
      qy = new Float64Array(positionCount);
      qz = new Float64Array(positionCount);
      weldTable = new Int32Array(weldCapacity).fill(-1);
      tableKeyA = new Uint32Array(capacity);
      tableKeyB = new Uint32Array(capacity);
      tableSlots = new Int32Array(capacity).fill(-1);
      edgeOrig0 = new Uint32Array(maxEdges);
      edgeOrig1 = new Uint32Array(maxEdges);
      edgeFace = new Uint32Array(maxEdges);
      edgeAlive = new Uint8Array(maxEdges);
      faceNX = new Float64Array(faceCount);
      faceNY = new Float64Array(faceCount);
      faceNZ = new Float64Array(faceCount);
      vertexBuffer = new Float32Array(indexCount * 2 * 3);
    }

    let edgeSlotCount = 0;
    let writeIndex = 0;

    // --- Pass 1: weld vertices into canonical ids -------------------------
    for (let v = 0; v < positionCount; v++) {
      const offset = v * 3;
      const x = Math.round(position[offset] * precision);
      const y = Math.round(position[offset + 1] * precision);
      const z = Math.round(position[offset + 2] * precision);
      qx[v] = x;
      qy[v] = y;
      qz[v] = z;

      const hx = (((x & 0xfffffffe) << 13) ^ (((x << 19) ^ x) >>> 12)) >>> 0;
      const hy = (((y & 0xfffffff8) << 2) ^ (((y << 25) ^ y) >>> 4)) >>> 0;
      const hz = (((z & 0xfffffff0) << 3) ^ (((z << 11) ^ z) >>> 17)) >>> 0;
      let probe = (hx ^ hy ^ hz) & weldMask;
      while (true) {
        const canonical = weldTable[probe];
        if (canonical === -1) {
          weldTable[probe] = v;
          welded[v] = v;
          break;
        }
        if (qx[canonical] === x && qy[canonical] === y && qz[canonical] === z) {
          welded[v] = canonical;
          break;
        }
        probe = (probe + 1) & weldMask;
      }
    }

    // --- Pass 2: edge pairing (unrolled, shared face normals) -------------
    for (let i = 0; i < indexCount; i += 3) {
      let i0: number;
      let i1: number;
      let i2: number;
      if (index) {
        i0 = index[i];
        i1 = index[i + 1];
        i2 = index[i + 2];
      } else {
        i0 = i;
        i1 = i + 1;
        i2 = i + 2;
      }

      const id0 = welded[i0];
      const id1 = welded[i1];
      const id2 = welded[i2];
      if (id0 === id1 || id1 === id2 || id2 === id0) {
        continue;
      }

      const o0 = i0 * 3;
      const o1 = i1 * 3;
      const o2 = i2 * 3;
      const x0 = position[o0],
        y0 = position[o0 + 1],
        z0 = position[o0 + 2];
      const x1 = position[o1],
        y1 = position[o1 + 1],
        z1 = position[o1 + 2];
      const x2 = position[o2],
        y2 = position[o2 + 1],
        z2 = position[o2 + 2];

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

      const face = (i / 3) | 0;
      faceNX[face] = nx;
      faceNY[face] = ny;
      faceNZ[face] = nz;

      // --- edge (i0 -> i1) ---
      {
        let foundSlot = -1;
        let probe =
          (Math.imul(id1, 0x85ebca77) ^ Math.imul(id0, 0xc2b2ae3d)) & mask;
        while (true) {
          const s = tableSlots[probe];
          if (s === -1) break;
          if (s >= 0 && tableKeyA[probe] === id1 && tableKeyB[probe] === id0) {
            foundSlot = s;
            tableSlots[probe] = -2;
            break;
          }
          probe = (probe + 1) & mask;
        }
        if (foundSlot >= 0) {
          edgeAlive[foundSlot] = 0;
          const f = edgeFace[foundSlot];
          const dotProduct =
            nx * Math.fround(faceNX[f]) +
            ny * Math.fround(faceNY[f]) +
            nz * Math.fround(faceNZ[f]);
          if (dotProduct <= thresholdDot) {
            vertexBuffer[writeIndex++] = x0;
            vertexBuffer[writeIndex++] = y0;
            vertexBuffer[writeIndex++] = z0;
            vertexBuffer[writeIndex++] = x1;
            vertexBuffer[writeIndex++] = y1;
            vertexBuffer[writeIndex++] = z1;
          }
        } else {
          let target = -1;
          probe =
            (Math.imul(id0, 0x85ebca77) ^ Math.imul(id1, 0xc2b2ae3d)) & mask;
          while (true) {
            const s = tableSlots[probe];
            if (s === -1) {
              if (target === -1) target = probe;
              break;
            }
            if (s === -2) {
              if (target === -1) target = probe;
            } else if (tableKeyA[probe] === id0 && tableKeyB[probe] === id1) {
              edgeAlive[s] = 0;
              target = probe;
              break;
            }
            probe = (probe + 1) & mask;
          }
          const slot = edgeSlotCount++;
          tableKeyA[target] = id0;
          tableKeyB[target] = id1;
          tableSlots[target] = slot;
          edgeAlive[slot] = 1;
          edgeOrig0[slot] = i0;
          edgeOrig1[slot] = i1;
          edgeFace[slot] = face;
        }
      }

      // --- edge (i1 -> i2) ---
      {
        let foundSlot = -1;
        let probe =
          (Math.imul(id2, 0x85ebca77) ^ Math.imul(id1, 0xc2b2ae3d)) & mask;
        while (true) {
          const s = tableSlots[probe];
          if (s === -1) break;
          if (s >= 0 && tableKeyA[probe] === id2 && tableKeyB[probe] === id1) {
            foundSlot = s;
            tableSlots[probe] = -2;
            break;
          }
          probe = (probe + 1) & mask;
        }
        if (foundSlot >= 0) {
          edgeAlive[foundSlot] = 0;
          const f = edgeFace[foundSlot];
          const dotProduct =
            nx * Math.fround(faceNX[f]) +
            ny * Math.fround(faceNY[f]) +
            nz * Math.fround(faceNZ[f]);
          if (dotProduct <= thresholdDot) {
            vertexBuffer[writeIndex++] = x1;
            vertexBuffer[writeIndex++] = y1;
            vertexBuffer[writeIndex++] = z1;
            vertexBuffer[writeIndex++] = x2;
            vertexBuffer[writeIndex++] = y2;
            vertexBuffer[writeIndex++] = z2;
          }
        } else {
          let target = -1;
          probe =
            (Math.imul(id1, 0x85ebca77) ^ Math.imul(id2, 0xc2b2ae3d)) & mask;
          while (true) {
            const s = tableSlots[probe];
            if (s === -1) {
              if (target === -1) target = probe;
              break;
            }
            if (s === -2) {
              if (target === -1) target = probe;
            } else if (tableKeyA[probe] === id1 && tableKeyB[probe] === id2) {
              edgeAlive[s] = 0;
              target = probe;
              break;
            }
            probe = (probe + 1) & mask;
          }
          const slot = edgeSlotCount++;
          tableKeyA[target] = id1;
          tableKeyB[target] = id2;
          tableSlots[target] = slot;
          edgeAlive[slot] = 1;
          edgeOrig0[slot] = i1;
          edgeOrig1[slot] = i2;
          edgeFace[slot] = face;
        }
      }

      // --- edge (i2 -> i0) ---
      {
        let foundSlot = -1;
        let probe =
          (Math.imul(id0, 0x85ebca77) ^ Math.imul(id2, 0xc2b2ae3d)) & mask;
        while (true) {
          const s = tableSlots[probe];
          if (s === -1) break;
          if (s >= 0 && tableKeyA[probe] === id0 && tableKeyB[probe] === id2) {
            foundSlot = s;
            tableSlots[probe] = -2;
            break;
          }
          probe = (probe + 1) & mask;
        }
        if (foundSlot >= 0) {
          edgeAlive[foundSlot] = 0;
          const f = edgeFace[foundSlot];
          const dotProduct =
            nx * Math.fround(faceNX[f]) +
            ny * Math.fround(faceNY[f]) +
            nz * Math.fround(faceNZ[f]);
          if (dotProduct <= thresholdDot) {
            vertexBuffer[writeIndex++] = x2;
            vertexBuffer[writeIndex++] = y2;
            vertexBuffer[writeIndex++] = z2;
            vertexBuffer[writeIndex++] = x0;
            vertexBuffer[writeIndex++] = y0;
            vertexBuffer[writeIndex++] = z0;
          }
        } else {
          let target = -1;
          probe =
            (Math.imul(id2, 0x85ebca77) ^ Math.imul(id0, 0xc2b2ae3d)) & mask;
          while (true) {
            const s = tableSlots[probe];
            if (s === -1) {
              if (target === -1) target = probe;
              break;
            }
            if (s === -2) {
              if (target === -1) target = probe;
            } else if (tableKeyA[probe] === id2 && tableKeyB[probe] === id0) {
              edgeAlive[s] = 0;
              target = probe;
              break;
            }
            probe = (probe + 1) & mask;
          }
          const slot = edgeSlotCount++;
          tableKeyA[target] = id2;
          tableKeyB[target] = id0;
          tableSlots[target] = slot;
          edgeAlive[slot] = 1;
          edgeOrig0[slot] = i2;
          edgeOrig1[slot] = i0;
          edgeFace[slot] = face;
        }
      }
    }

    // --- Emit remaining unmatched edges in insertion order ----------------
    for (let slot = 0; slot < edgeSlotCount; slot++) {
      if (edgeAlive[slot] === 0) continue;
      const offset0 = edgeOrig0[slot] * 3;
      const offset1 = edgeOrig1[slot] * 3;
      vertexBuffer[writeIndex++] = position[offset0];
      vertexBuffer[writeIndex++] = position[offset0 + 1];
      vertexBuffer[writeIndex++] = position[offset0 + 2];
      vertexBuffer[writeIndex++] = position[offset1];
      vertexBuffer[writeIndex++] = position[offset1 + 1];
      vertexBuffer[writeIndex++] = position[offset1 + 2];
    }

    const finalBuffer = vertexBuffer.slice(0, writeIndex);
    this.setAttribute("position", new Float32BufferAttribute(finalBuffer, 3));
  }

  copy(source: CandidateMix) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
}
