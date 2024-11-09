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

export class FastEdgesGeometry extends BufferGeometry {
  readonly type = "EdgesGeometry";
  parameters: { geometry: BufferGeometry | null; thresholdAngle: number };

  constructor(geometry: BufferGeometry | null = null, thresholdAngle = 1) {
    super();

    this.parameters = {
      geometry: geometry,
      thresholdAngle: thresholdAngle,
    };

    if (geometry !== null) {
      const precisionPoints = 4;
      const precision = Math.pow(10, precisionPoints);
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

        hashes[0] = FastEdgesGeometry.computeVertexHash(
          Math.round(a.x * precision),
          Math.round(a.y * precision),
          Math.round(a.z * precision),
        );
        hashes[1] = FastEdgesGeometry.computeVertexHash(
          Math.round(b.x * precision),
          Math.round(b.y * precision),
          Math.round(b.z * precision),
        );
        if (hashes[0] === hashes[1]) {
          continue;
        }
        hashes[2] = FastEdgesGeometry.computeVertexHash(
          Math.round(c.x * precision),
          Math.round(c.y * precision),
          Math.round(c.z * precision),
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

          const hash = FastEdgesGeometry.computeVertexHash(vecHash0, vecHash1);
          const reverseHash = FastEdgesGeometry.computeVertexHash(
            vecHash1,
            vecHash0,
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
   * Computes a hash value for a vertex based on its x, y, and z coordinates.
   * This hash function uses three prime numbers to combine the coordinates
   * into a single hash value.
   *
   * @param x - The x-coordinate of the vertex.
   * @param y - The y-coordinate of the vertex.
   * @param z - The z-coordinate of the vertex. Defaults to 0 if not provided.
   * @returns The computed hash value for the vertex.
   */
  static computeVertexHash(x: number, y: number, z: number = 0): number {
    const prime1 = 31;
    const prime2 = 37;
    const prime3 = 41;
    return x * prime1 + y * prime2 + z * prime3;
  }
}
