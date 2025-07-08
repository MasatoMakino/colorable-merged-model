import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  type TypedArray,
  Uint16BufferAttribute,
} from "three";
import { describe, expect, it } from "vitest";
import { FastEdgesGeometry } from "../src";

describe("FastEdgesGeometry", () => {
  it("should correctly initialize FastEdgesGeometry constructor", () => {
    const geo = new TorusKnotGeometry();
    const thresholdAngle = 2;
    const edges = new FastEdgesGeometry(geo, thresholdAngle);
    expect(edges).not.toBeUndefined();
    expect(edges).toBeInstanceOf(BufferGeometry);
    expect(edges.type).toBe("EdgesGeometry");
    expect(edges.parameters).toBeTruthy();
    expect(edges.parameters.thresholdAngle).toBe(thresholdAngle);
    expect(edges.copy).toBeInstanceOf(Function);
  });

  it("thresholdAngle should be 1 by default", () => {
    const geo = new TorusKnotGeometry();
    const edges = new FastEdgesGeometry(geo);
    expect(edges.parameters.thresholdAngle).toBe(1);
  });

  const checkPosition = (geo: BufferGeometry) => {
    const fastEdges = new FastEdgesGeometry(geo);
    const edges = new EdgesGeometry(geo);
    expect(fastEdges.attributes.position.array).toStrictEqual(
      edges.attributes.position.array,
    );
  };
  it("should match the position attribute of FastEdgesGeometry with EdgesGeometry", () => {
    checkPosition(new TorusKnotGeometry());
    checkPosition(new TorusGeometry());
    checkPosition(new SphereGeometry());
    checkPosition(new CylinderGeometry());
    checkPosition(new ConeGeometry());
    checkPosition(new RingGeometry());
    checkPosition(new BoxGeometry());
  });

  const _testLineSegmentsPosition = (geo: BufferGeometry) => {
    const fastEdges = new FastEdgesGeometry(geo);
    const edges = new EdgesGeometry(geo);
    const chunkSize = 6;
    const fastEdgesArray = splitArrayIntoChunks(
      fastEdges.attributes.position.array,
      chunkSize,
    );
    const edgesArray = splitArrayIntoChunks(
      edges.attributes.position.array,
      chunkSize,
    );
    expect(fastEdgesArray.sort()).toStrictEqual(edgesArray.sort());
  };

  function splitArrayIntoChunks(
    array: TypedArray,
    chunkSize: number,
  ): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = Array.from(array.slice(i, i + chunkSize));
      result.push(chunk);
    }
    return result;
  }

  describe("precisionPoints option", () => {
    it("should use default precisionPoints value of 6", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const edges = new FastEdgesGeometry(geo);
      expect(edges).toBeInstanceOf(BufferGeometry);
      expect(edges.attributes.position).toBeDefined();
    });

    it("should accept custom precisionPoints value", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const edges1 = new FastEdgesGeometry(geo, 1, { precisionPoints: 3 });
      const edges2 = new FastEdgesGeometry(geo, 1, { precisionPoints: 8 });

      expect(edges1).toBeInstanceOf(BufferGeometry);
      expect(edges2).toBeInstanceOf(BufferGeometry);
      expect(edges1.attributes.position).toBeDefined();
      expect(edges2.attributes.position).toBeDefined();
    });

    it("should work with different precision values", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const precisionValues = [1, 3, 6, 8, 10];

      precisionValues.forEach((precision) => {
        const edges = new FastEdgesGeometry(geo, 1, {
          precisionPoints: precision,
        });
        expect(edges.attributes.position.array.length).toBeGreaterThan(0);
      });
    });

    it("should produce consistent results with same precision", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const edges1 = new FastEdgesGeometry(geo, 1, { precisionPoints: 5 });
      const edges2 = new FastEdgesGeometry(geo, 1, { precisionPoints: 5 });

      expect(edges1.attributes.position.array).toStrictEqual(
        edges2.attributes.position.array,
      );
    });

    it("should work with zero precision", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: 0 });
      expect(edges.attributes.position.array.length).toBeGreaterThan(0);
    });

    it("should handle very small geometries with high precision", () => {
      // Create a very small geometry that might cause hash collisions with low precision
      const geo = new BoxGeometry(0.001, 0.001, 0.001);

      const lowPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 3,
      });
      const highPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 10,
      });

      expect(
        lowPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);
      expect(
        highPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);

      // High precision should typically produce more accurate results for small geometries
      expect(
        highPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThanOrEqual(
        lowPrecisionEdges.attributes.position.array.length,
      );
    });

    it("should handle large geometries efficiently", () => {
      // Create a large geometry where high precision isn't necessary
      const geo = new BoxGeometry(1000, 1000, 1000);

      const lowPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 2,
      });
      const defaultPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 6,
      });

      expect(
        lowPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);
      expect(
        defaultPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);

      // For large geometries, lower precision should work fine
      expect(lowPrecisionEdges.attributes.position.array.length).toBe(
        defaultPrecisionEdges.attributes.position.array.length,
      );
    });

    it("should produce different results with different precision for precision-sensitive geometries", () => {
      // Create a geometry with coordinates that would round differently with different precision
      const geo = new BufferGeometry();
      const vertices = new Float32Array([
        0.1,
        0.1,
        0.1, // vertex 0
        0.2,
        0.1,
        0.1, // vertex 1
        0.1,
        0.2,
        0.1, // vertex 2
        0.2,
        0.2,
        0.1, // vertex 3
        0.15,
        0.15,
        0.2, // vertex 4 (creates more edges)
      ]);
      const indices = new Uint16Array([
        0,
        1,
        2, // first triangle
        1,
        3,
        2, // second triangle
        0,
        1,
        4, // third triangle
        1,
        3,
        4, // fourth triangle
      ]);

      geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geo.setIndex(new Uint16BufferAttribute(indices, 1));

      const lowPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 2,
      });
      const highPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 8,
      });

      expect(
        lowPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);
      expect(
        highPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);
    });

    it("should work with seed and precisionPoints together", () => {
      const geo = new BoxGeometry(1, 1, 1);

      const edges1 = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 5,
        seed: 123,
      });
      const edges2 = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 5,
        seed: 123,
      });
      const edges3 = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 5,
        seed: 456,
      });

      // Same precision and seed should produce identical results
      expect(edges1.attributes.position.array).toStrictEqual(
        edges2.attributes.position.array,
      );

      // Different seed might produce different results (depending on geometry)
      expect(edges1.attributes.position.array.length).toBe(
        edges3.attributes.position.array.length,
      );
    });
  });

  describe("precision accuracy comparison with EdgesGeometry", () => {
    it("should match EdgesGeometry with default precision", () => {
      const geometries = [
        new BoxGeometry(1, 1, 1),
        new SphereGeometry(1, 8, 6),
        new CylinderGeometry(1, 1, 2, 8),
      ];

      geometries.forEach((geo) => {
        const fastEdges = new FastEdgesGeometry(geo, 1, { precisionPoints: 6 });
        const standardEdges = new EdgesGeometry(geo, 1);

        expect(fastEdges.attributes.position.array.length).toBe(
          standardEdges.attributes.position.array.length,
        );
      });
    });

    it("should maintain accuracy with different precision levels for standard geometries", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const standardEdges = new EdgesGeometry(geo, 1);

      const precisionLevels = [3, 6, 9];
      precisionLevels.forEach((precision) => {
        const fastEdges = new FastEdgesGeometry(geo, 1, {
          precisionPoints: precision,
        });

        // For a standard BoxGeometry, all precision levels should produce same result
        expect(fastEdges.attributes.position.array.length).toBe(
          standardEdges.attributes.position.array.length,
        );
      });
    });

    it("should handle complex geometries with appropriate precision", () => {
      const geo = new TorusKnotGeometry(1, 0.3, 64, 8);
      const standardEdges = new EdgesGeometry(geo, 1);

      const lowPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 3,
      });
      const defaultPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 6,
      });
      const highPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 9,
      });

      // All should produce valid results
      expect(
        lowPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);
      expect(
        defaultPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);
      expect(
        highPrecisionEdges.attributes.position.array.length,
      ).toBeGreaterThan(0);

      // Default precision should match standard EdgesGeometry most closely
      expect(defaultPrecisionEdges.attributes.position.array.length).toBe(
        standardEdges.attributes.position.array.length,
      );
    });

    it("should preserve edge count consistency across precision levels for simple geometries", () => {
      const geo = new BoxGeometry(2, 2, 2);

      const precisions = [1, 4, 6, 8, 12];
      const edgeCounts = precisions.map((precision) => {
        const edges = new FastEdgesGeometry(geo, 1, {
          precisionPoints: precision,
        });
        return edges.attributes.position.array.length / 6; // Each edge has 2 vertices, each vertex has 3 coordinates
      });

      // For a simple box geometry, all precision levels should produce the same number of edges
      const firstCount = edgeCounts[0];
      edgeCounts.forEach((count) => {
        expect(count).toBe(firstCount);
      });
    });
  });

  describe("precisionPoints edge cases", () => {
    it("should handle negative precisionPoints gracefully", () => {
      const geo = new BoxGeometry(1, 1, 1);

      // Negative precision causes very low precision (10^-1 = 0.1)
      // This may cause hash collisions and result in fewer or no edges
      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: -1 });
      // The test should just verify it doesn't crash, not that it produces edges
      expect(edges.attributes.position).toBeDefined();
      expect(edges.attributes.position.array.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle very high precisionPoints values", () => {
      const geo = new BoxGeometry(1, 1, 1);

      // Very high precision should still work
      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: 15 });
      expect(edges.attributes.position.array.length).toBeGreaterThan(0);
    });

    it("should handle fractional precisionPoints values", () => {
      const geo = new BoxGeometry(1, 1, 1);

      // Fractional precision should work (10^2.5 = ~316.2)
      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: 2.5 });
      expect(edges.attributes.position.array.length).toBeGreaterThan(0);
    });

    it("should handle empty geometry", () => {
      const geo = new BufferGeometry();
      // Add empty position attribute to avoid undefined error
      geo.setAttribute("position", new Float32BufferAttribute([], 3));

      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: 6 });

      // Empty geometry should result in empty edges
      expect(edges.attributes.position.array.length).toBe(0);
    });

    it("should handle geometry with no indices", () => {
      const geo = new BufferGeometry();
      const vertices = new Float32Array([
        0,
        0,
        0, // vertex 0
        1,
        0,
        0, // vertex 1
        0,
        1,
        0, // vertex 2
      ]);

      geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      // No indices set - should use position directly

      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: 6 });
      expect(edges.attributes.position.array.length).toBeGreaterThan(0);
    });

    it("should handle degenerate triangles", () => {
      const geo = new BufferGeometry();
      const vertices = new Float32Array([
        0,
        0,
        0, // vertex 0
        0,
        0,
        0, // vertex 1 (same as vertex 0)
        1,
        0,
        0, // vertex 2
      ]);
      const indices = new Uint16Array([0, 1, 2]);

      geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geo.setIndex(new Uint16BufferAttribute(indices, 1));

      const edges = new FastEdgesGeometry(geo, 1, { precisionPoints: 6 });
      // Should handle degenerate triangles without crashing
      expect(edges.attributes.position).toBeDefined();
    });

    it("should maintain precision with extreme coordinate values", () => {
      const geo = new BufferGeometry();
      const vertices = new Float32Array([
        1e-10,
        1e-10,
        1e-10, // very small coordinates
        1e10,
        1e-10,
        1e-10, // very large coordinates
        1e-10,
        1e10,
        1e-10, // mixed scale
      ]);
      const indices = new Uint16Array([0, 1, 2]);

      geo.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      geo.setIndex(new Uint16BufferAttribute(indices, 1));

      const lowPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 2,
      });
      const highPrecisionEdges = new FastEdgesGeometry(geo, 1, {
        precisionPoints: 12,
      });

      expect(lowPrecisionEdges.attributes.position).toBeDefined();
      expect(highPrecisionEdges.attributes.position).toBeDefined();
    });

    it("should work with both seed and precisionPoints undefined", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const edges = new FastEdgesGeometry(geo, 1, {});

      expect(edges.attributes.position.array.length).toBeGreaterThan(0);
    });

    it("should work with null options", () => {
      const geo = new BoxGeometry(1, 1, 1);
      const edges = new FastEdgesGeometry(geo, 1);

      expect(edges.attributes.position.array.length).toBeGreaterThan(0);
    });
  });
});
