import { BufferGeometry, Float32BufferAttribute, MathUtils } from "three";

/**
 * Candidate F: Candidate E + cache-oriented memory layout.
 *
 * - Edge-table cells are interleaved in ONE Int32Array with stride 4
 *   (`[keyA, keyB, slot+1, pad]`, 16 bytes/cell): a probe touches a single
 *   cache line instead of three separate arrays. Cell state: slot field
 *   0 = empty, -1 = tombstone, >0 = slot + 1.
 * - Quantized vertex coordinates are interleaved (stride 4) in one
 *   Int32Array, so a weld comparison reads one cache line.
 * - Int32 quantization halves memory traffic vs Float64; freshly allocated
 *   typed arrays are zero-initialized, so the empty-marker fills of E
 *   (`fill(-1)`) disappear as well.
 *
 * Prototype restrictions: non-interleaved position attributes only;
 * quantized coordinates must fit in int32 (|coord| * 10^precisionPoints
 * < 2^31, throws RangeError otherwise).
 */
export class CandidateF extends BufferGeometry {
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

    // --- Pass 1: weld (interleaved int32 quantized coords) ----------------
    const welded = new Int32Array(positionCount);
    const q = new Int32Array(positionCount * 4);

    let weldCapacity = 16;
    while (weldCapacity < positionCount * 2) weldCapacity <<= 1;
    const weldMask = weldCapacity - 1;
    // cell value = canonical id + 1, 0 = empty (fresh arrays are zeroed)
    const weldTable = new Int32Array(weldCapacity);

    for (let v = 0; v < positionCount; v++) {
      const offset = v * 3;
      const fx = Math.round(position[offset] * precision);
      const fy = Math.round(position[offset + 1] * precision);
      const fz = Math.round(position[offset + 2] * precision);
      const x = fx | 0;
      const y = fy | 0;
      const z = fz | 0;
      if (x !== fx || y !== fy || z !== fz) {
        throw new RangeError(
          "CandidateF: quantized coordinate exceeds int32 range",
        );
      }
      const v4 = v * 4;
      q[v4] = x;
      q[v4 + 1] = y;
      q[v4 + 2] = z;

      const hx = (((x & 0xfffffffe) << 13) ^ (((x << 19) ^ x) >>> 12)) >>> 0;
      const hy = (((y & 0xfffffff8) << 2) ^ (((y << 25) ^ y) >>> 4)) >>> 0;
      const hz = (((z & 0xfffffff0) << 3) ^ (((z << 11) ^ z) >>> 17)) >>> 0;
      let probe = (hx ^ hy ^ hz) & weldMask;
      while (true) {
        const c = weldTable[probe];
        if (c === 0) {
          weldTable[probe] = v + 1;
          welded[v] = v;
          break;
        }
        const c4 = (c - 1) * 4;
        if (q[c4] === x && q[c4 + 1] === y && q[c4 + 2] === z) {
          welded[v] = c - 1;
          break;
        }
        probe = (probe + 1) & weldMask;
      }
    }

    // --- Pass 2: edge pairing (interleaved table cells) -------------------
    const faceCount = (indexCount / 3) | 0;
    const faceNX = new Float64Array(faceCount);
    const faceNY = new Float64Array(faceCount);
    const faceNZ = new Float64Array(faceCount);

    const maxEdges = indexCount;
    const edgeOrig0 = new Uint32Array(maxEdges);
    const edgeOrig1 = new Uint32Array(maxEdges);
    const edgeFace = new Uint32Array(maxEdges);
    const edgeAlive = new Uint8Array(maxEdges);
    let edgeSlotCount = 0;

    let capacity = 16;
    while (capacity < maxEdges * 2) capacity <<= 1;
    const mask = capacity - 1;
    // cell = [keyA, keyB, slot+1 (0=empty, -1=tombstone), pad]
    const table = new Int32Array(capacity * 4);

    const vertexBuffer = new Float32Array(indexCount * 2 * 3);
    let writeIndex = 0;

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
          const cell = probe << 2;
          const sp = table[cell + 2];
          if (sp === 0) break;
          if (sp > 0 && table[cell] === id1 && table[cell + 1] === id0) {
            foundSlot = sp - 1;
            table[cell + 2] = -1;
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
            const cell = probe << 2;
            const sp = table[cell + 2];
            if (sp === 0) {
              if (target === -1) target = cell;
              break;
            }
            if (sp === -1) {
              if (target === -1) target = cell;
            } else if (table[cell] === id0 && table[cell + 1] === id1) {
              edgeAlive[sp - 1] = 0;
              target = cell;
              break;
            }
            probe = (probe + 1) & mask;
          }
          const slot = edgeSlotCount++;
          table[target] = id0;
          table[target + 1] = id1;
          table[target + 2] = slot + 1;
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
          const cell = probe << 2;
          const sp = table[cell + 2];
          if (sp === 0) break;
          if (sp > 0 && table[cell] === id2 && table[cell + 1] === id1) {
            foundSlot = sp - 1;
            table[cell + 2] = -1;
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
            const cell = probe << 2;
            const sp = table[cell + 2];
            if (sp === 0) {
              if (target === -1) target = cell;
              break;
            }
            if (sp === -1) {
              if (target === -1) target = cell;
            } else if (table[cell] === id1 && table[cell + 1] === id2) {
              edgeAlive[sp - 1] = 0;
              target = cell;
              break;
            }
            probe = (probe + 1) & mask;
          }
          const slot = edgeSlotCount++;
          table[target] = id1;
          table[target + 1] = id2;
          table[target + 2] = slot + 1;
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
          const cell = probe << 2;
          const sp = table[cell + 2];
          if (sp === 0) break;
          if (sp > 0 && table[cell] === id0 && table[cell + 1] === id2) {
            foundSlot = sp - 1;
            table[cell + 2] = -1;
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
            const cell = probe << 2;
            const sp = table[cell + 2];
            if (sp === 0) {
              if (target === -1) target = cell;
              break;
            }
            if (sp === -1) {
              if (target === -1) target = cell;
            } else if (table[cell] === id2 && table[cell + 1] === id0) {
              edgeAlive[sp - 1] = 0;
              target = cell;
              break;
            }
            probe = (probe + 1) & mask;
          }
          const slot = edgeSlotCount++;
          table[target] = id2;
          table[target + 1] = id0;
          table[target + 2] = slot + 1;
          edgeAlive[slot] = 1;
          edgeOrig0[slot] = i2;
          edgeOrig1[slot] = i0;
          edgeFace[slot] = face;
        }
      }
    }

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
}
