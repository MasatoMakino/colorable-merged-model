import { ShaderMaterial, ShaderMaterialParameters, Vector4 } from "three";

export interface IColorableMergedMaterial {
  setColor(index: number, color: [number, number, number, number]): void;
}

export class ColorableMergedMaterial
  extends ShaderMaterial
  implements IColorableMergedMaterial
{
  constructor(param: ShaderMaterialParameters, colorsLength: number) {
    super(param);
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
  setColor(index: number, color: [number, number, number, number]) {
    const colors = this.uniforms.colors.value as Vector4[];
    colors[index].set(color[0], color[1], color[2], color[3]);
  }
}
