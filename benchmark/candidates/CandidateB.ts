import { BufferGeometry, Float32BufferAttribute, MathUtils } from "three";

/**
 * Candidate B: vertex-weld pre-pass + exact integer pair keys.
 *
 * Pass 1 (weld): every vertex is quantized and hashed exactly once. A vertex
 * hash collision is resolved by comparing the quantized coordinates, so each
 * vertex maps to an exact canonical id (0..V-1).
 *
 * Pass 2 (edges): an edge is identified by the directed pair of canonical ids
 * (id0, id1). Pair lookups compare both ids exactly, therefore **hash
 * collisions cannot corrupt edge detection** — the `seed` workaround of the
 * current implementation becomes unnecessary (the option is accepted but
 * ignored).
 *
 * Prototype restriction: supports non-interleaved position attributes only.
 */
export class CandidateB extends BufferGeometry {
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

    // --- Pass 1: weld vertices into canonical ids -------------------------
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

      // 32-bit scramble for table indexing only; exactness comes from the
      // coordinate comparison below
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

    // --- Pass 2: edge pairing with exact (id0, id1) keys ------------------
    const maxEdges = indexCount;
    const edgeIndex0 = new Uint32Array(maxEdges);
    const edgeIndex1 = new Uint32Array(maxEdges);
    const edgeNormalX = new Float32Array(maxEdges);
    const edgeNormalY = new Float32Array(maxEdges);
    const edgeNormalZ = new Float32Array(maxEdges);
    const edgeAlive = new Uint8Array(maxEdges);
    let edgeSlotCount = 0;

    let capacity = 16;
    while (capacity < maxEdges * 2) capacity <<= 1;
    const mask = capacity - 1;
    const tableKeyA = new Uint32Array(capacity);
    const tableKeyB = new Uint32Array(capacity);
    const tableSlots = new Int32Array(capacity).fill(-1);

    const vertexBuffer = new Float32Array(indexCount * 2 * 3);
    let writeIndex = 0;

    const triIndex = [0, 0, 0];
    const triId = [0, 0, 0];
    const triX = [0, 0, 0];
    const triY = [0, 0, 0];
    const triZ = [0, 0, 0];

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

      // skip degenerate triangles (exact comparison, no hash involved)
      if (
        triId[0] === triId[1] ||
        triId[1] === triId[2] ||
        triId[2] === triId[0]
      ) {
        continue;
      }

      for (let j = 0; j < 3; j++) {
        const offset = triIndex[j] * 3;
        triX[j] = position[offset];
        triY[j] = position[offset + 1];
        triZ[j] = position[offset + 2];
      }

      const e1x = triX[1] - triX[0],
        e1y = triY[1] - triY[0],
        e1z = triZ[1] - triZ[0];
      const e2x = triX[2] - triX[0],
        e2y = triY[2] - triY[0],
        e2z = triZ[2] - triZ[0];
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

      for (let j = 0; j < 3; j++) {
        const jNext = (j + 1) % 3;
        const id0 = triId[j];
        const id1 = triId[jNext];

        // Probe for the sibling edge (id1 -> id0), exact key comparison
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
          const dotProduct =
            nx * edgeNormalX[foundSlot] +
            ny * edgeNormalY[foundSlot] +
            nz * edgeNormalZ[foundSlot];
          if (dotProduct <= thresholdDot) {
            vertexBuffer[writeIndex++] = triX[j];
            vertexBuffer[writeIndex++] = triY[j];
            vertexBuffer[writeIndex++] = triZ[j];
            vertexBuffer[writeIndex++] = triX[jNext];
            vertexBuffer[writeIndex++] = triY[jNext];
            vertexBuffer[writeIndex++] = triZ[jNext];
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
              edgeAlive[s] = 0; // dropped by overwrite, as Map.set would do
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
          edgeIndex0[slot] = triIndex[j];
          edgeIndex1[slot] = triIndex[jNext];
          edgeNormalX[slot] = nx;
          edgeNormalY[slot] = ny;
          edgeNormalZ[slot] = nz;
        }
      }
    }

    for (let slot = 0; slot < edgeSlotCount; slot++) {
      if (edgeAlive[slot] === 0) continue;
      const offset0 = edgeIndex0[slot] * 3;
      const offset1 = edgeIndex1[slot] * 3;
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
}
