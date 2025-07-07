import {
  type Blending,
  FrontSide,
  IUniform,
  NormalBlending,
  type Side,
  UniformsLib,
  UniformsUtils,
} from "three";
import type { TweenableColorMap } from "../TweenableColorMap.js";
import { fragment, vertex } from "./ColorableMergedBodyMaterial.glsl.js";
import { ColorableMergedMaterial } from "./ColorableMergedMaterial.js";

export interface ColorableMergedBodyMaterialParam {
  blending?: Blending;
  side?: Side;
}
export class ColorableMergedBodyMaterial extends ColorableMergedMaterial {
  constructor(
    readonly colors: TweenableColorMap,
    param?: ColorableMergedBodyMaterialParam,
  ) {
    super(
      {
        vertexShader: vertex,
        fragmentShader: fragment,
      },
      colors.getSize(),
    );

    this.uniforms = ColorableMergedBodyMaterial.getBasicUniforms(
      colors.getSize(),
    );
    this.transparent = true;
    this.blending = param?.blending ?? NormalBlending;
    this.side = param?.side ?? FrontSide;

    colors.setMaterial(this);
    colors.updateUniformsAll();
  }

  /**
   * このMaterialに必要なuniformsを生成する。
   *
   * @see https://github.com/mrdoob/three.js/blob/0c26bb4bb8220126447c8373154ac045588441de/src/renderers/shaders/ShaderLib.js#L11
   */
  public static getBasicUniforms(colorsCount: number): {
    [uniform: string]: IUniform;
  } {
    return UniformsUtils.merge([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.fog,
      ColorableMergedMaterial.getColorUniform(colorsCount),
    ]);
  }
}
