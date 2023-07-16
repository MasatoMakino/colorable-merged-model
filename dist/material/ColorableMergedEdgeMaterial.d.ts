import { ShaderMaterial } from "three";
import { IColorableMergedMaterial } from "./index.js";
export interface ColorableMergedEdgeMaterialParam {
  depthWrite?: boolean;
}
export declare class ColorableMergedEdgeMaterial
  extends ShaderMaterial
  implements IColorableMergedMaterial
{
  constructor(colorLength: number, param?: ColorableMergedEdgeMaterialParam);
  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  static getBasicUniforms(colorLength: number): any;
  setColor(index: number, color: [number, number, number, number]): void;
}
//# sourceMappingURL=ColorableMergedEdgeMaterial.d.ts.map
