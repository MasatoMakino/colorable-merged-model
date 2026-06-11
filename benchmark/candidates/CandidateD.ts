import { BufferGeometry, Float32BufferAttribute, MathUtils } from "three";

/**
 * Candidate D: same algorithm as the current FastEdgesGeometry, but with the
 * BufferAttribute abstraction removed from the hot loop.
 *
 * - `indexAttr.getX()` / `Vector3.fromBufferAttribute()` are replaced with
 *   direct typed-array reads (`position[i * 3]`).
 * - The edge map (`Map<number, number>`), hash function, and pairing logic are
 *   unchanged, isolating the contribution of attribute-access overhead.
 *
 * Prototype restriction: supports non-interleaved position attributes only.
 */
export class CandidateD extends BufferGeometry {
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

    const index = indexAttr ? indexAttr.array : null;
    const position = positionAttr.array;

    const seed = options?.seed ?? 255;
    const transformedSeed = (seed * 1664525 + 1013904223) >>> 0;

    const maxEdges = indexCount;
    const edgeIndex0 = new Uint32Array(maxEdges);
    const edgeIndex1 = new Uint32Array(maxEdges);
    const edgeNormalX = new Float32Array(maxEdges);
    const edgeNormalY = new Float32Array(maxEdges);
    const edgeNormalZ = new Float32Array(maxEdges);
    const edgeHashToSlot = new Map<number, number>();
    let edgeSlotCount = 0;

    const vertexBuffer = new Float32Array(indexCount * 2 * 3);
    let writeIndex = 0;

    const computeHash = (x: number, y: number, z: number): number => {
      x = (((x & 0xfffffffe) << 13) ^ (((x << 19) ^ x) >>> 12)) >>> 0;
      y = (((y & 0xfffffff8) << 2) ^ (((y << 25) ^ y) >>> 4)) >>> 0;
      z = (((z & 0xfffffff0) << 3) ^ (((z << 11) ^ z) >>> 17)) >>> 0;
      return (x ^ y ^ z ^ transformedSeed) >>> 0;
    };

    // Flat scratch for the 3 vertex indices, hashes and coordinates of a triangle
    const triIndex = [0, 0, 0];
    const triHash = [0, 0, 0];
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

      triHash[0] = computeHash(
        Math.round(triX[0] * precision),
        Math.round(triY[0] * precision),
        Math.round(triZ[0] * precision),
      );
      triHash[1] = computeHash(
        Math.round(triX[1] * precision),
        Math.round(triY[1] * precision),
        Math.round(triZ[1] * precision),
      );
      if (triHash[0] === triHash[1]) {
        continue;
      }
      triHash[2] = computeHash(
        Math.round(triX[2] * precision),
        Math.round(triY[2] * precision),
        Math.round(triZ[2] * precision),
      );
      if (triHash[1] === triHash[2] || triHash[2] === triHash[0]) {
        continue;
      }

      for (let j = 0; j < 3; j++) {
        const jNext = (j + 1) % 3;
        const vecHash0 = triHash[j];
        const vecHash1 = triHash[jNext];

        const hash = computeHash(vecHash0, vecHash1, 0);
        const reverseHash = computeHash(vecHash1, vecHash0, 0);

        const reverseSlot = edgeHashToSlot.get(reverseHash);
        if (reverseSlot !== undefined) {
          const dotProduct =
            nx * edgeNormalX[reverseSlot] +
            ny * edgeNormalY[reverseSlot] +
            nz * edgeNormalZ[reverseSlot];
          if (dotProduct <= thresholdDot) {
            vertexBuffer[writeIndex++] = triX[j];
            vertexBuffer[writeIndex++] = triY[j];
            vertexBuffer[writeIndex++] = triZ[j];
            vertexBuffer[writeIndex++] = triX[jNext];
            vertexBuffer[writeIndex++] = triY[jNext];
            vertexBuffer[writeIndex++] = triZ[jNext];
          }
          edgeHashToSlot.delete(reverseHash);
        } else {
          const slot = edgeSlotCount++;
          edgeHashToSlot.set(hash, slot);
          edgeIndex0[slot] = triIndex[j];
          edgeIndex1[slot] = triIndex[jNext];
          edgeNormalX[slot] = nx;
          edgeNormalY[slot] = ny;
          edgeNormalZ[slot] = nz;
        }
      }
    }

    edgeHashToSlot.forEach((slot) => {
      const offset0 = edgeIndex0[slot] * 3;
      const offset1 = edgeIndex1[slot] * 3;
      vertexBuffer[writeIndex++] = position[offset0];
      vertexBuffer[writeIndex++] = position[offset0 + 1];
      vertexBuffer[writeIndex++] = position[offset0 + 2];
      vertexBuffer[writeIndex++] = position[offset1];
      vertexBuffer[writeIndex++] = position[offset1 + 1];
      vertexBuffer[writeIndex++] = position[offset1 + 2];
    });

    const finalBuffer = vertexBuffer.slice(0, writeIndex);
    this.setAttribute("position", new Float32BufferAttribute(finalBuffer, 3));
  }
}
