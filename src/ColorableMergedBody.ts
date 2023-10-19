import { Mesh } from "three";
import { ColorableMergedBodyMaterialParam, MergedBody } from "./index.js";

export interface ColorableMergedBodyParam {
  color: [number, number, number, number];
}
export class ColorableMergedBody extends Mesh {
  readonly model: MergedBody;

  constructor(option: ColorableMergedBodyParam) {
    super();
    this.model = new MergedBody(this, option);
  }
}
