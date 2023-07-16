import { Blending, ShaderMaterial, Side } from "three";
import { IColorableMergedMaterial } from "./index.js";
export interface ColorableMergedBodyMaterialParam {
  blending?: Blending;
  side?: Side;
}
export declare class ColorableMergedBodyMaterial
  extends ShaderMaterial
  implements IColorableMergedMaterial
{
  constructor(colorsLength: number, param?: ColorableMergedBodyMaterialParam);
  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  static getBasicUniforms(colorsCount: number): any;
  setColor(index: number, color: [number, number, number, number]): void;
}
//# sourceMappingURL=ColorableMergedBodyMaterial.d.ts.map
