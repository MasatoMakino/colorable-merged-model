import {
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  Triangle,
  Vector3,
} from "three";

const _v0 = /*@__PURE__*/ new Vector3();
const _v1 = /*@__PURE__*/ new Vector3();
const _normal = /*@__PURE__*/ new Vector3();
const _triangle = /*@__PURE__*/ new Triangle();

/**
 * FastEdgesGeometry is a performance-optimized version of EdgesGeometry that generates edges
 * for a given geometry based on a specified threshold angle.
 *
 * While this class provides improved performance, it may encounter hash collisions when provided
 * with custom geometries. As a result, it may not be fully compatible with all geometries.
 * If edge generation fails, consider adjusting the seed value in the options.
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
   */
  constructor(
    geometry: BufferGeometry | null = null,
    thresholdAngle = 1,
    options?: { seed?: number },
  ) {
    super();

    this.parameters = {
      geometry: geometry,
      thresholdAngle: thresholdAngle,
    };

    if (geometry !== null) {
      const precisionPoints = 4;
      const precision = 10 ** precisionPoints;
      const thresholdDot = Math.cos(MathUtils.DEG2RAD * thresholdAngle);

      const indexAttr = geometry.getIndex();
      const positionAttr = geometry.getAttribute("position");
      const indexCount = indexAttr ? indexAttr.count : positionAttr.count;

      const indexArr = [0, 0, 0];
      const vertKeys: (keyof Triangle)[] = ["a", "b", "c"];
      const hashes = new Array(3);

      const edgeData = new Map<
        number,
        {
          index0: number;
          index1: number;
          normal: Vector3;
        }
      >();
      const vertices = [];

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

        const { a, b, c } = _triangle;
        a.fromBufferAttribute(positionAttr, indexArr[0]);
        b.fromBufferAttribute(positionAttr, indexArr[1]);
        c.fromBufferAttribute(positionAttr, indexArr[2]);
        _triangle.getNormal(_normal);

        // create hashes for the edge from the vertices

        hashes[0] = FastEdgesGeometry.hybridtaus(
          Math.round(a.x * precision),
          Math.round(a.y * precision),
          Math.round(a.z * precision),
          options?.seed,
        );
        hashes[1] = FastEdgesGeometry.hybridtaus(
          Math.round(b.x * precision),
          Math.round(b.y * precision),
          Math.round(b.z * precision),
          options?.seed,
        );
        if (hashes[0] === hashes[1]) {
          continue;
        }
        hashes[2] = FastEdgesGeometry.hybridtaus(
          Math.round(c.x * precision),
          Math.round(c.y * precision),
          Math.round(c.z * precision),
          options?.seed,
        );

        // skip degenerate triangles
        if (hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
          continue;
        }

        // iterate over every edge
        for (let j = 0; j < 3; j++) {
          // get the first and next vertex making up the edge
          const jNext = (j + 1) % 3;
          const vecHash0 = hashes[j];
          const vecHash1 = hashes[jNext];
          const v0 = _triangle[vertKeys[j]] as Vector3;
          const v1 = _triangle[vertKeys[jNext]] as Vector3;

          const hash = FastEdgesGeometry.hybridtaus(
            vecHash0,
            vecHash1,
            0,
            options?.seed,
          );
          const reverseHash = FastEdgesGeometry.hybridtaus(
            vecHash1,
            vecHash0,
            0,
            options?.seed,
          );

          const reverseHashEdgeData = edgeData.get(reverseHash);
          if (reverseHashEdgeData !== undefined) {
            // if we found a sibling edge add it into the vertex array if
            // it meets the angle threshold and delete the edge from the map.
            if (_normal.dot(reverseHashEdgeData.normal) <= thresholdDot) {
              vertices.push(v0.x, v0.y, v0.z);
              vertices.push(v1.x, v1.y, v1.z);
            }
            edgeData.delete(reverseHash);
          } else {
            // If there is no hash collision, edgeData will not contain the edge, so add it
            edgeData.set(hash, {
              index0: indexArr[j],
              index1: indexArr[jNext],
              normal: _normal.clone(),
            });
          }
        }
      }

      // iterate over all remaining, unmatched edges and add them to the vertex array
      edgeData.forEach((value) => {
        const { index0, index1 } = value;
        _v0.fromBufferAttribute(positionAttr, index0);
        _v1.fromBufferAttribute(positionAttr, index1);

        vertices.push(_v0.x, _v0.y, _v0.z);
        vertices.push(_v1.x, _v1.y, _v1.z);
      });

      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
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
