import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  type TypedArray,
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
});
