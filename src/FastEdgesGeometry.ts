import {
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  Vector3,
} from "three";

const _v0 = /*@__PURE__*/ new Vector3();
const _v1 = /*@__PURE__*/ new Vector3();
const _a = /*@__PURE__*/ new Vector3();
const _b = /*@__PURE__*/ new Vector3();
const _c = /*@__PURE__*/ new Vector3();

/**
 * FastEdgesGeometry is a performance-optimized version of EdgesGeometry that generates edges
 * for a given geometry based on a specified threshold angle.
 *
 * While this class provides improved performance, it may encounter hash collisions when provided
 * with custom geometries. As a result, it may not be fully compatible with all geometries.
 * If edge generation fails, consider adjusting the seed value in the options.
 *
 * Note: This class is not thread-safe due to shared static arrays.
 * Use separate instances in concurrent environments.
 *
 * @param geometry - The input BufferGeometry for which edges are to be generated. Defaults to null.
 * @param thresholdAngle - The angle threshold in degrees to consider an edge. Defaults to 1.
 * @param options - Optional parameters.
 * @param options.seed - An optional seed value for hash generation.
 *
 */
export class FastEdgesGeometry extends BufferGeometry {
  readonly type = "EdgesGeometry";
  parameters: { geometry: BufferGeometry | null; thresholdAngle: number };

  // Static arrays to avoid repeated allocation
  private static readonly _indexArray = [0, 0, 0];
  private static readonly _hashArray = new Array<number>(3);

  /**
   * Creates an instance of FastEdgesGeometry.
   *
   * This class extends BufferGeometry and is used to generate edges for a given geometry
   * based on a specified threshold angle. It provides an optimized implementation for
   * edge generation.
   *
   * @param geometry - The input BufferGeometry for which edges are to be generated. Defaults to null.
   * @param thresholdAngle - The angle threshold in degrees to consider an edge. Defaults to 1.
   * @param options - Optional parameters.
   * @param options.seed - An optional seed value for hash generation.
   * @param options.precisionPoints - The number of decimal places to consider for vertex coordinate precision when hashing. Defaults to 6. Higher values may be needed for small geometries to avoid hash collisions.
   */
  constructor(
    geometry: BufferGeometry | null = null,
    thresholdAngle = 1,
    options?: { seed?: number; precisionPoints?: number },
  ) {
    super();

    this.parameters = {
      geometry: geometry,
      thresholdAngle: thresholdAngle,
    };

    if (geometry !== null) {
      const precisionPoints = options?.precisionPoints ?? 6;
      const precision = 10 ** precisionPoints;
      const thresholdDot = Math.cos(MathUtils.DEG2RAD * thresholdAngle);

      const indexAttr = geometry.getIndex();
      const positionAttr = geometry.getAttribute("position");
      const indexCount = indexAttr ? indexAttr.count : positionAttr.count;

      const indexArr = FastEdgesGeometry._indexArray;
      const hashes = FastEdgesGeometry._hashArray;

      // Phase 1 B: Cache seed and pre-transform
      const seed = options?.seed ?? 255;
      const transformedSeed = (seed * 1664525 + 1013904223) >>> 0;

      // Phase 2 D: Typed Array for edge storage
      // Maximum edges = number of triangles * 3 (each triangle has 3 edges)
      const maxEdges = indexCount;
      const edgeIndex0 = new Uint32Array(maxEdges);
      const edgeIndex1 = new Uint32Array(maxEdges);
      const edgeNormalX = new Float32Array(maxEdges);
      const edgeNormalY = new Float32Array(maxEdges);
      const edgeNormalZ = new Float32Array(maxEdges);
      const edgeHashToSlot = new Map<number, number>();
      let edgeSlotCount = 0;

      // Phase 2 E: Pre-allocate vertex buffer
      // Each triangle has 3 edges, but edges are shared between triangles
      // In worst case, all edges are output (boundary edges + threshold edges)
      // Using indexCount (total edge count = triangles * 3) as upper bound
      const vertexBuffer = new Float32Array(indexCount * 2 * 3);
      let writeIndex = 0;

      // Phase 1 A: Inline hash computation function
      const computeHash = (x: number, y: number, z: number): number => {
        x = (((x & 0xfffffffe) << 13) ^ (((x << 19) ^ x) >>> 12)) >>> 0;
        y = (((y & 0xfffffff8) << 2) ^ (((y << 25) ^ y) >>> 4)) >>> 0;
        z = (((z & 0xfffffff0) << 3) ^ (((z << 11) ^ z) >>> 17)) >>> 0;
        return (x ^ y ^ z ^ transformedSeed) >>> 0;
      };

      for (let i = 0; i < indexCount; i += 3) {
        if (indexAttr) {
          indexArr[0] = indexAttr.getX(i);
          indexArr[1] = indexAttr.getX(i + 1);
          indexArr[2] = indexAttr.getX(i + 2);
        } else {
          indexArr[0] = i;
          indexArr[1] = i + 1;
          indexArr[2] = i + 2;
        }

        _a.fromBufferAttribute(positionAttr, indexArr[0]);
        _b.fromBufferAttribute(positionAttr, indexArr[1]);
        _c.fromBufferAttribute(positionAttr, indexArr[2]);

        // Phase 1 C: Direct normal computation (cross product)
        const e1x = _b.x - _a.x,
          e1y = _b.y - _a.y,
          e1z = _b.z - _a.z;
        const e2x = _c.x - _a.x,
          e2y = _c.y - _a.y,
          e2z = _c.z - _a.z;
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

        // create hashes for the edge from the vertices (using inline hash)
        hashes[0] = computeHash(
          Math.round(_a.x * precision),
          Math.round(_a.y * precision),
          Math.round(_a.z * precision),
        );
        hashes[1] = computeHash(
          Math.round(_b.x * precision),
          Math.round(_b.y * precision),
          Math.round(_b.z * precision),
        );
        if (hashes[0] === hashes[1]) {
          continue;
        }
        hashes[2] = computeHash(
          Math.round(_c.x * precision),
          Math.round(_c.y * precision),
          Math.round(_c.z * precision),
        );

        // skip degenerate triangles
        if (hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
          continue;
        }

        // Phase 3 H: Direct vertex references (no Triangle object)
        const triangleVerts = [_a, _b, _c];

        // iterate over every edge
        for (let j = 0; j < 3; j++) {
          // get the first and next vertex making up the edge
          const jNext = (j + 1) % 3;
          const vecHash0 = hashes[j];
          const vecHash1 = hashes[jNext];
          const v0 = triangleVerts[j];
          const v1 = triangleVerts[jNext];

          const hash = computeHash(vecHash0, vecHash1, 0);
          const reverseHash = computeHash(vecHash1, vecHash0, 0);

          const reverseSlot = edgeHashToSlot.get(reverseHash);
          if (reverseSlot !== undefined) {
            // if we found a sibling edge add it into the vertex array if
            // it meets the angle threshold and delete the edge from the map.
            const dotProduct =
              nx * edgeNormalX[reverseSlot] +
              ny * edgeNormalY[reverseSlot] +
              nz * edgeNormalZ[reverseSlot];
            if (dotProduct <= thresholdDot) {
              vertexBuffer[writeIndex++] = v0.x;
              vertexBuffer[writeIndex++] = v0.y;
              vertexBuffer[writeIndex++] = v0.z;
              vertexBuffer[writeIndex++] = v1.x;
              vertexBuffer[writeIndex++] = v1.y;
              vertexBuffer[writeIndex++] = v1.z;
            }
            edgeHashToSlot.delete(reverseHash);
          } else {
            // If there is no hash collision, edgeData will not contain the edge, so add it
            const slot = edgeSlotCount++;
            edgeHashToSlot.set(hash, slot);
            edgeIndex0[slot] = indexArr[j];
            edgeIndex1[slot] = indexArr[jNext];
            edgeNormalX[slot] = nx;
            edgeNormalY[slot] = ny;
            edgeNormalZ[slot] = nz;
          }
        }
      }

      // iterate over all remaining, unmatched edges and add them to the vertex array
      edgeHashToSlot.forEach((slot) => {
        const index0 = edgeIndex0[slot];
        const index1 = edgeIndex1[slot];
        _v0.fromBufferAttribute(positionAttr, index0);
        _v1.fromBufferAttribute(positionAttr, index1);

        vertexBuffer[writeIndex++] = _v0.x;
        vertexBuffer[writeIndex++] = _v0.y;
        vertexBuffer[writeIndex++] = _v0.z;
        vertexBuffer[writeIndex++] = _v1.x;
        vertexBuffer[writeIndex++] = _v1.y;
        vertexBuffer[writeIndex++] = _v1.z;
      });

      // Create final buffer with exact size
      const finalBuffer = vertexBuffer.slice(0, writeIndex);
      this.setAttribute("position", new Float32BufferAttribute(finalBuffer, 3));
    }
  }

  copy(source: FastEdgesGeometry) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }

  /**
   * Applies the Tausworthe algorithm to generate a pseudo-random number.
   *
   * This function takes an input number `z` and applies a series of bitwise operations
   * using the provided shift values (`s1`, `s2`, `s3`) and a mask value. The result is
   * a pseudo-random number generated using the Tausworthe algorithm.
   *
   * @param z - The input number to be transformed.
   * @param s1 - The first shift value.
   * @param s2 - The second shift value.
   * @param s3 - The third shift value.
   * @param mask - The mask value to be applied.
   * @returns The transformed number as a result of the Tausworthe algorithm.
   */
  static taus(
    z: number,
    s1: number,
    s2: number,
    s3: number,
    mask: number,
  ): number {
    const u32 = (n: number) => n >>> 0;
    return u32(((z & mask) << s1) ^ (((z << s2) ^ z) >>> s3));
  }

  /**
   * Computes a hash value for a vertex based on the hybrid Tausworthe algorithm.
   * https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch37.html
   * @param x - The x-coordinate of the vertex.
   * @param y - The y-coordinate of the vertex.
   * @param z - The z-coordinate of the vertex.
   * @param seed - The seed value for the hash. Defaults to 255 if not provided.
   * @returns The computed hash value.
   */
  static hybridtaus(
    x: number,
    y: number,
    z: number,
    seed: number = 255,
  ): number {
    const u32 = (n: number) => n >>> 0;

    x = FastEdgesGeometry.taus(x, 13, 19, 12, 0xfffffffe);
    y = FastEdgesGeometry.taus(y, 2, 25, 4, 0xfffffff8);
    z = FastEdgesGeometry.taus(z, 3, 11, 17, 0xfffffff0);
    seed = u32(seed * 1664525 + 1013904223);

    return u32(x ^ y ^ z ^ seed);
  }
}
