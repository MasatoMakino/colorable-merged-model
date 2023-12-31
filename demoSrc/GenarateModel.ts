import { BoxGeometry, ShaderMaterial } from "three";
import {
  ColorableMergedBody,
  ColorableMergedBodyMaterial,
  ColorableMergedEdge,
  ColorableMergedEdgeMaterial,
  ColorableMergedView,
  TweenableColorMap,
} from "../src/index.js";

export async function generateModel(
  n: number = 20,
): Promise<ColorableMergedView> {
  const option = {
    bodyOption: { color: [1, 1, 1, 0.2] as [number, number, number, number] },
    edgeOption: { color: [1, 1, 1, 0.8] as [number, number, number, number] },
  };

  const view: ColorableMergedView = new ColorableMergedView(option);
  const bodyColors = new TweenableColorMap("colors");
  const edgeColors = new TweenableColorMap("colors");

  const addModel = async (x: number, y: number, z: number) => {
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

  const promises: Promise<void>[] = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        promises.push(addModel(x, y, z));
      }
    }
  }
  await Promise.all(promises);
  await view.merge();

  if (view.body) {
    view.body.material = new ColorableMergedBodyMaterial(bodyColors);
  }
  if (view.edge) {
    view.edge.material = new ColorableMergedEdgeMaterial(edgeColors);
  }

  return view;
}
