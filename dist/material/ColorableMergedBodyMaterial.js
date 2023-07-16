import {
  FrontSide,
  NormalBlending,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector4,
} from "three";
import { fragment, vertex } from "./ColorableMergedBodyMaterial.glsl.js";
export class ColorableMergedBodyMaterial extends ShaderMaterial {
  constructor(colorsLength, param) {
    var _a, _b;
    super({
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.defines = {
      INDEX: colorsLength,
    };
    this.uniforms = ColorableMergedBodyMaterial.getBasicUniforms(colorsLength);
    this.transparent = true;
    this.blending =
      (_a = param === null || param === void 0 ? void 0 : param.blending) !==
        null && _a !== void 0
        ? _a
        : NormalBlending;
    this.side =
      (_b = param === null || param === void 0 ? void 0 : param.side) !==
        null && _b !== void 0
        ? _b
        : FrontSide;
  }
  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  static getBasicUniforms(colorsCount) {
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
  setColor(index, color) {
    const colors = this.uniforms.colors.value;
    colors[index].set(color[0], color[1], color[2], color[3]);
  }
}
