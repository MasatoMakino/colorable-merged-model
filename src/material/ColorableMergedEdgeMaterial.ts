import { UniformsLib, UniformsUtils } from "three";
import { ColorableMergedMaterial } from "./index.js";
import { fragment, vertex } from "./ColorableMergedEdgeMaterial.glsl.js";

export interface ColorableMergedEdgeMaterialParam {
  depthWrite?: boolean;
}
export class ColorableMergedEdgeMaterial extends ColorableMergedMaterial {
  constructor(colorLength: number, param?: ColorableMergedEdgeMaterialParam) {
    super(
      {
        vertexShader: vertex,
        fragmentShader: fragment,
      },
      colorLength,
    );

    this.uniforms = ColorableMergedEdgeMaterial.getBasicUniforms(colorLength);
    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;
  }

  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  public static getBasicUniforms(colorLength: number): any {
    return UniformsUtils.merge([
      UniformsLib.common,
      UniformsLib.fog,
      {
        scale: { value: 1 },
        dashSize: { value: 1 },
        totalSize: { value: 2 },
      },
      ColorableMergedMaterial.getColorUniform(colorLength),
    ]);
  }
}
