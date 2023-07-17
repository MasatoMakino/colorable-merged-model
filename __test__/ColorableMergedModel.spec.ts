import { ColorableMergedModel } from "../src";
import { BoxGeometry } from "three";

describe("ColorableMergedModel", () => {
  const generateModel = () => {
    return new ColorableMergedModel({
      bodyOption: { color: [1, 1, 1, 1] },
      edgeOption: { color: [1, 1, 1, 1] },
    });
  };

  test("constructor", () => {
    const model = generateModel();
    expect(model).toBeTruthy();
  });

  test("empty model", async () => {
    const model = new ColorableMergedModel({});
    expect(model).toBeTruthy();
    expect(model.body).toBeUndefined();
    expect(model.edge).toBeUndefined();
  });

  test("geometry id", () => {
    const model = generateModel();
    const id = model.getGeometryID("test_1_2");
    expect(id).toStrictEqual(2);
  });

  test("geometry id invalid", () => {
    const model = generateModel();
    expect(() => model.getGeometryID("test_1")).toThrowError();
  });

  test("switch geometry id generator", () => {
    const model = generateModel();
    model.getGeometryID = (name: string): number => {
      const match = name.match(/.*_(\d*)/);
      return Number(match?.[1]);
    };
    expect(model.getGeometryID("test_1")).toStrictEqual(1);
  });

  test("add model", async () => {
    const model = generateModel();
    model.addModel(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await model.generate();
    expect(model.body?.colorMap.colors.size).toStrictEqual(1);
    expect(model.edge?.colorMap.colors.size).toStrictEqual(1);
  });

  test("add model with type", async () => {
    const model = generateModel();
    model.addModel(new BoxGeometry(1, 1, 1, 1, 1, 1), 1, "test");
    await model.generate();
    expect(model.body?.colorMap.colors.size).toStrictEqual(1);
    expect(model.edge?.colorMap.colors.size).toStrictEqual(1);
    expect(model.body?.colorMap.get(1, "test")).toBeTruthy();
    expect(model.edge?.colorMap.get(1, "test")).toBeTruthy();
  });

  test("add empty model", async () => {
    const model = new ColorableMergedModel({});
    model.addModel(new BoxGeometry(1, 1, 1, 1, 1, 1), 1);
    await model.generate();
    expect(model.body).toBeUndefined();
    expect(model.edge).toBeUndefined();
  });
});
