import { describe, expect, it } from "vitest";
import { FastEdgesGeometry } from "../src";
import { BufferGeometry, EdgesGeometry, TorusKnotGeometry } from "three";

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

  it("should match the position attribute of FastEdgesGeometry with EdgesGeometry", () => {
    const geo = new TorusKnotGeometry();
    const fastEdges = new FastEdgesGeometry(geo);
    const edges = new EdgesGeometry(geo);
    expect(fastEdges.attributes.position.array).toStrictEqual(
      edges.attributes.position.array,
    );
  });
});
