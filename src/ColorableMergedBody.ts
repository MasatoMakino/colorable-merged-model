import { Mesh } from "three";
import { BodyGeometryMerger } from "./index.js";

export interface ColorableMergedBodyParam {
  color: [number, number, number, number];
}
export class ColorableMergedBody extends Mesh {
  readonly geometryMerger: BodyGeometryMerger;
  constructor(option: ColorableMergedBodyParam) {
    super();
    this.geometryMerger = new BodyGeometryMerger(this, option);
  }
}
