import { ShaderMaterial, ShaderMaterialParameters, Vector4 } from "three";
import { IColorableMergedMaterial } from "./IColorableMergedMaterial.js";

export class ColorableMergedMaterial
  extends ShaderMaterial
  implements IColorableMergedMaterial
{
  readonly isColorableMergedMaterial: boolean = true;

  constructor(param: ShaderMaterialParameters, colorsLength: number) {
    super(param);
    if (colorsLength === 0) {
      throw new Error(`ColorableMergedMaterialには少なくとも1つ以上のTweenableColorが必要です。
        このMaterialに紐づけられたTweenableColoMapには1つもTweenableColorが登録されていません。`);
    }
    this.isColorableMergedMaterial = true;
    this.initDefine(colorsLength);
  }

  initDefine = (colorsLength: number) => {
    this.defines = {
      INDEX: colorsLength, // TODO rename to COLORS_LENGTH
    };
  };
  static getColorUniform(colorLength: number) {
    const colors = new Array(colorLength)
      .fill(0)
      .map(() => new Vector4(1, 1, 1, 0.5));
    return {
      colors: { value: colors },
    };
  }
}
