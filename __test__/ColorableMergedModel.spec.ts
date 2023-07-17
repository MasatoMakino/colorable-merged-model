import { ColorableMergedModel } from "../src";

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
});
