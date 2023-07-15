import {
  Blending,
  FrontSide,
  NormalBlending,
  ShaderMaterial,
  Side,
  UniformsLib,
  UniformsUtils,
  Vector4,
} from "three";
import { IColorableMergedMaterial } from "./";
import { fragment, vertex } from "./ColorableMergedBodyMaterial.glsl.js";

export interface ColorableMergedBodyMaterialParam {
  blending?: Blending;
  side?: Side;
}
export class ColorableMergedBodyMaterial
  extends ShaderMaterial
  implements IColorableMergedMaterial
{
  constructor(colorsLength: number, param?: ColorableMergedBodyMaterialParam) {
    super({
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.defines = {
      INDEX: colorsLength,
    };
    this.uniforms = ColorableMergedBodyMaterial.getBasicUniforms(colorsLength);
    this.transparent = true;

    this.blending = param?.blending ?? NormalBlending;
    this.side = param?.side ?? FrontSide;
  }

  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  public static getBasicUniforms(colorsCount: number): any {
    const colors = new Array(colorsCount)
      .fill(0)
      .map(() => new Vector4(1, 1, 1, 0.5));
    return UniformsUtils.merge([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.fog,
      {
        colors: { value: colors },
      },
    ]);
  }

  setColor(index: number, color: [number, number, number, number]) {
    const colors = this.uniforms.colors.value as Vector4[];
    colors[index].set(color[0], color[1], color[2], color[3]);
  }
}
