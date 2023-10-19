import { BoxGeometry } from "three";
import {
  ColorableMergedBody,
  ColorableMergedBodyMaterial,
  ColorableMergedEdge,
  ColorableMergedEdgeMaterial,
  ColorableMergedView,
} from "../src/index.js";

export async function generateModel(
  n: number = 20,
): Promise<ColorableMergedView> {
  const option = {
    bodyOption: { color: [1, 1, 1, 0.2] as [number, number, number, number] },
    edgeOption: { color: [1, 1, 1, 0.8] as [number, number, number, number] },
  };

  const view: ColorableMergedView = new ColorableMergedView(option);

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
    return await view.addGeometry(geo, index);
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

  const body = view.body as ColorableMergedBody;
  body.material = new ColorableMergedBodyMaterial(
    body.model.colorMap.getSize(),
  );

  const edge = view.edge as ColorableMergedEdge;
  edge.material = new ColorableMergedEdgeMaterial(
    edge.model.colorMap.getSize(),
  );

  return view;
}
