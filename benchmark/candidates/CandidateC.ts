import { BufferGeometry, Float32BufferAttribute, MathUtils } from "three";

/**
 * Candidate C: sort-based edge pairing — no hash table at all.
 *
 * 1. Weld pre-pass: vertices -> exact canonical ids (same as Candidate B).
 * 2. Collect pass: every triangle edge is appended to flat typed arrays as
 *    (minId, maxId, direction, face index, raw vertex indices).
 * 3. A stable LSD radix sort (16-bit digits) orders edges by (minId, maxId);
 *    identical undirected edges become adjacent.
 * 4. A linear walk over the sorted edges pairs opposite-direction siblings
 *    inside each group and applies the threshold-angle test.
 *
 * All passes are sequential typed-array scans, which makes this layout the
 * most portable to WASM / GPU / worker chunking. Output segment order differs
 * from EdgesGeometry (sorted by edge key, not encounter order); the edge SET
 * is the comparison target.
 *
 * Prototype restriction: supports non-interleaved position attributes only.
 */
export class CandidateC extends BufferGeometry {
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
    const position = positionAttr.array;

    // --- Pass 1: weld vertices into canonical ids (same as Candidate B) ---
    const welded = new Int32Array(positionCount);
    const qx = new Float64Array(positionCount);
    const qy = new Float64Array(positionCount);
    const qz = new Float64Array(positionCount);

    let weldCapacity = 16;
    while (weldCapacity < positionCount * 2) weldCapacity <<= 1;
    const weldMask = weldCapacity - 1;
    const weldTable = new Int32Array(weldCapacity).fill(-1);

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

    // --- Pass 2: collect all edges into flat arrays ------------------------
    // float64 to reproduce the dot-product semantics of the hash-based
    // implementations: current-face normal in float64, stored normal rounded
    // to float32 (see Math.fround at the pairing step). Threshold-boundary
    // edges are sensitive to this rounding.
    const faceCount = Math.floor(indexCount / 3);
    const faceNX = new Float64Array(faceCount);
    const faceNY = new Float64Array(faceCount);
    const faceNZ = new Float64Array(faceCount);

    const maxEdges = indexCount;
    const edgeMin = new Uint32Array(maxEdges);
    const edgeMax = new Uint32Array(maxEdges);
    const edgeDir = new Uint8Array(maxEdges); // 1 when id0 < id1
    const edgeFace = new Uint32Array(maxEdges);
    const edgeOrig0 = new Uint32Array(maxEdges);
    const edgeOrig1 = new Uint32Array(maxEdges);
    let edgeCount = 0;

    const triIndex = [0, 0, 0];
    const triId = [0, 0, 0];

    for (let i = 0; i < indexCount; i += 3) {
      if (index) {
        triIndex[0] = index[i];
        triIndex[1] = index[i + 1];
        triIndex[2] = index[i + 2];
      } else {
        triIndex[0] = i;
        triIndex[1] = i + 1;
        triIndex[2] = i + 2;
      }

      triId[0] = welded[triIndex[0]];
      triId[1] = welded[triIndex[1]];
      triId[2] = welded[triIndex[2]];

      if (
        triId[0] === triId[1] ||
        triId[1] === triId[2] ||
        triId[2] === triId[0]
      ) {
        continue;
      }

      const face = i / 3;
      const o0 = triIndex[0] * 3;
      const o1 = triIndex[1] * 3;
      const o2 = triIndex[2] * 3;
      const ax = position[o0],
        ay = position[o0 + 1],
        az = position[o0 + 2];
      const e1x = position[o1] - ax,
        e1y = position[o1 + 1] - ay,
        e1z = position[o1 + 2] - az;
      const e2x = position[o2] - ax,
        e2y = position[o2 + 1] - ay,
        e2z = position[o2 + 2] - az;
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
      faceNX[face] = nx;
      faceNY[face] = ny;
      faceNZ[face] = nz;

      for (let j = 0; j < 3; j++) {
        const jNext = (j + 1) % 3;
        const id0 = triId[j];
        const id1 = triId[jNext];
        const e = edgeCount++;
        if (id0 < id1) {
          edgeMin[e] = id0;
          edgeMax[e] = id1;
          edgeDir[e] = 1;
        } else {
          edgeMin[e] = id1;
          edgeMax[e] = id0;
          edgeDir[e] = 0;
        }
        edgeFace[e] = face;
        edgeOrig0[e] = triIndex[j];
        edgeOrig1[e] = triIndex[jNext];
      }
    }

    // --- Pass 3: stable LSD radix sort by (minId major, maxId minor) ------
    let perm = new Uint32Array(edgeCount);
    for (let i = 0; i < edgeCount; i++) perm[i] = i;
    let temp = new Uint32Array(edgeCount);
    const counts = new Uint32Array(65536);

    const radixPass = (
      src: Uint32Array,
      dst: Uint32Array,
      keys: Uint32Array,
      shift: number,
    ): void => {
      counts.fill(0);
      for (let i = 0; i < edgeCount; i++) {
        counts[(keys[src[i]] >>> shift) & 0xffff]++;
      }
      let sum = 0;
      for (let d = 0; d < 65536; d++) {
        const c = counts[d];
        counts[d] = sum;
        sum += c;
      }
      for (let i = 0; i < edgeCount; i++) {
        const e = src[i];
        dst[counts[(keys[e] >>> shift) & 0xffff]++] = e;
      }
    };

    const needHighPass = positionCount > 0xffff;
    radixPass(perm, temp, edgeMax, 0);
    [perm, temp] = [temp, perm];
    if (needHighPass) {
      radixPass(perm, temp, edgeMax, 16);
      [perm, temp] = [temp, perm];
    }
    radixPass(perm, temp, edgeMin, 0);
    [perm, temp] = [temp, perm];
    if (needHighPass) {
      radixPass(perm, temp, edgeMin, 16);
      [perm, temp] = [temp, perm];
    }

    // --- Pass 4: pair adjacent edges within equal-key groups --------------
    const vertexBuffer = new Float32Array(indexCount * 2 * 3);
    let writeIndex = 0;

    const emit = (e: number): void => {
      const offset0 = edgeOrig0[e] * 3;
      const offset1 = edgeOrig1[e] * 3;
      vertexBuffer[writeIndex++] = position[offset0];
      vertexBuffer[writeIndex++] = position[offset0 + 1];
      vertexBuffer[writeIndex++] = position[offset0 + 2];
      vertexBuffer[writeIndex++] = position[offset1];
      vertexBuffer[writeIndex++] = position[offset1 + 1];
      vertexBuffer[writeIndex++] = position[offset1 + 2];
    };

    // Unmatched edges within the current group (group sizes are tiny: 2 for
    // manifold meshes, 1 on boundaries, >2 only on non-manifold geometry)
    const pending: number[] = [];

    let i = 0;
    while (i < edgeCount) {
      const groupMin = edgeMin[perm[i]];
      const groupMax = edgeMax[perm[i]];
      let groupEnd = i + 1;
      while (
        groupEnd < edgeCount &&
        edgeMin[perm[groupEnd]] === groupMin &&
        edgeMax[perm[groupEnd]] === groupMax
      ) {
        groupEnd++;
      }

      pending.length = 0;
      for (let g = i; g < groupEnd; g++) {
        const e = perm[g];
        // Latest unmatched sibling with opposite direction wins, mirroring
        // Map.set() overwrite semantics of the hash-based implementations
        let siblingPos = -1;
        let duplicatePos = -1;
        for (let p = pending.length - 1; p >= 0; p--) {
          const other = pending[p];
          if (edgeDir[other] !== edgeDir[e]) {
            if (siblingPos === -1) siblingPos = p;
          } else if (duplicatePos === -1) {
            duplicatePos = p;
          }
        }

        if (siblingPos >= 0) {
          const other = pending[siblingPos];
          pending.splice(siblingPos, 1);
          const f0 = edgeFace[e]; // later entry = "current" face
          const f1 = edgeFace[other]; // earlier entry = "stored" face
          const dotProduct =
            faceNX[f0] * Math.fround(faceNX[f1]) +
            faceNY[f0] * Math.fround(faceNY[f1]) +
            faceNZ[f0] * Math.fround(faceNZ[f1]);
          if (dotProduct <= thresholdDot) {
            emit(e);
          }
        } else {
          if (duplicatePos >= 0) {
            // a later identical directed edge replaces the earlier one
            pending.splice(duplicatePos, 1);
          }
          pending.push(e);
        }
      }
      for (const e of pending) {
        emit(e);
      }

      i = groupEnd;
    }

    const finalBuffer = vertexBuffer.slice(0, writeIndex);
    this.setAttribute("position", new Float32BufferAttribute(finalBuffer, 3));
  }
}
