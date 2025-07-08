import { IUniform, UniformsLib, UniformsUtils } from "three";
import type { TweenableColorMap } from "../TweenableColorMap.js";
import { fragment, vertex } from "./ColorableMergedEdgeMaterial.glsl.js";
import { ColorableMergedMaterial } from "./ColorableMergedMaterial.js";

export interface ColorableMergedEdgeMaterialParam {
  depthWrite?: boolean;
}
export class ColorableMergedEdgeMaterial extends ColorableMergedMaterial {
  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedEdgeMaterialParam,
  ) {
    super(
      {
        vertexShader: vertex,
        fragmentShader: fragment,
      },
      colors.getSize(),
    );

    this.uniforms = ColorableMergedEdgeMaterial.getBasicUniforms(
      colors.getSize(),
    );
    this.depthWrite = param?.depthWrite ?? true;
    this.transparent = true;

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  public static getBasicUniforms(colorLength: number): {
    [uniform: string]: IUniform;
  } {
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
