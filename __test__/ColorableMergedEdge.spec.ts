import { ColorableMergedEdge } from "../src";
import { BoxGeometry } from "three";

describe("ColorableMergedEdge", () => {
  test("constructor", () => {
    const edge = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
    expect(edge).toBeTruthy();
  });

  test("generate empty edge", async () => {
    const edge = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
    await edge.generate();
    expect(edge.colorMap.colors.size).toStrictEqual(0);
  });

  test("generate", async () => {
    const edge = new ColorableMergedEdge({ color: [1, 1, 1, 1] });
    edge.addModel(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await edge.generate();
    expect(edge.colorMap.colors.size).toStrictEqual(1);
  });
});
