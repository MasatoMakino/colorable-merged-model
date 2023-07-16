import { ShaderMaterial, UniformsLib, UniformsUtils, Vector4 } from "three";
import { fragment, vertex } from "./ColorableMergedEdgeMaterial.glsl.js";
export class ColorableMergedEdgeMaterial extends ShaderMaterial {
  constructor(colorLength, param) {
    var _a;
    super({
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.defines = {
      INDEX: colorLength,
    };
    this.uniforms = ColorableMergedEdgeMaterial.getBasicUniforms(colorLength);
    this.depthWrite =
      (_a = param === null || param === void 0 ? void 0 : param.depthWrite) !==
        null && _a !== void 0
        ? _a
        : true;
    this.transparent = true;
  }
  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  static getBasicUniforms(colorLength) {
    const colors = new Array(colorLength)
      .fill(0)
      .map(() => new Vector4(1, 1, 1, 0.5));
    return UniformsUtils.merge([
      UniformsLib.common,
      UniformsLib.fog,
      {
        scale: { value: 1 },
        dashSize: { value: 1 },
        totalSize: { value: 2 },
      },
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
