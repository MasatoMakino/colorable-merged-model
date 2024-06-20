import { BoxGeometry, Material } from "three";
import {
  ColorableMergedBodyMaterial,
  ColorableMergedBodyNodeMaterial,
  ColorableMergedEdgeMaterial,
  ColorableMergedEdgeNodeMaterial,
  ColorableMergedView,
  TweenableColorMap,
} from "../src/index.js";

export async function generateModel(
  n: number = 20,
  type?: "webgl" | "webgpu",
): Promise<ColorableMergedView> {
  type = type ?? "webgl";
  const option = {
    bodyOption: { color: [1, 1, 1, 0.2] as [number, number, number, number] },
    edgeOption: { color: [1, 1, 1, 0.8] as [number, number, number, number] },
  };

  const view: ColorableMergedView = new ColorableMergedView(option);
  const bodyColors = new TweenableColorMap("colors");
  const edgeColors = new TweenableColorMap("colors");

  await addBoxAll(n, view, bodyColors, edgeColors);
  initMaterial(view, bodyColors, edgeColors, getMaterialConstractors(type));

  return view;
}

/**
 * レンダラーの種類に応じたMaterialクラスを取得
 * @param type
 * @returns
 */
const getMaterialConstractors = (type: "webgl" | "webgpu") => {
  if (type === "webgpu") {
    return {
      bodyMaterialClass: ColorableMergedBodyNodeMaterial,
      edgeMaterialClass: ColorableMergedEdgeNodeMaterial,
    };
  }
  return {
    bodyMaterialClass: ColorableMergedBodyMaterial,
    edgeMaterialClass: ColorableMergedEdgeMaterial,
  };
};

/**
 * Boxを指定個数生成、追加する
 * @param n
 * @param view
 * @param bodyColors
 * @param edgeColors
 */
const addBoxAll = async (
  n: number,
  view: ColorableMergedView,
  bodyColors: TweenableColorMap,
  edgeColors: TweenableColorMap,
) => {
  const promises: Promise<void>[] = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        promises.push(
          addBoxModelAndColor(n, x, y, z, view, bodyColors, edgeColors),
        );
      }
    }
  }
  await Promise.all(promises);
  await view.merge();
};

/**
 * Boxを1つ生成、追加する
 * @param n
 * @param x
 * @param y
 * @param z
 * @param view
 * @param bodyColors
 * @param edgeColors
 */
const addBoxModelAndColor = async (
  n: number,
  x: number,
  y: number,
  z: number,
  view: ColorableMergedView,
  bodyColors: TweenableColorMap,
  edgeColors: TweenableColorMap,
) => {
  const size = 0.1;
  const geo = new BoxGeometry(size, size, size);

  const getQuadrant = (i: number): number => {
    return i < n / 2 ? -1 : 1;
  };
  const index = getQuadrant(x) * getQuadrant(y) * getQuadrant(z);
  const calcPos = (i: number) => {
    return (i - n / 2) * (size * 3);
  };
  geo.translate(calcPos(x), calcPos(y), calcPos(z));

  bodyColors.add([1, 1, 1, 0.2], index);
  edgeColors.add([1, 1, 1, 0.8], index);

  await view.body?.geometryMerger.add(geo, bodyColors, index);
  await view.edge?.geometryMerger.add(geo, edgeColors, index);
};

const initMaterial = (
  view: ColorableMergedView,
  bodyColors: TweenableColorMap,
  edgeColors: TweenableColorMap,
  materialConstractors: {
    bodyMaterialClass: new (colors: TweenableColorMap) => Material;
    edgeMaterialClass: new (colors: TweenableColorMap) => Material;
  },
) => {
  if (view.body) {
    view.body.material = new materialConstractors.bodyMaterialClass(bodyColors);
  }
  if (view.edge) {
    view.edge.material = new materialConstractors.edgeMaterialClass(edgeColors);
  }
};
