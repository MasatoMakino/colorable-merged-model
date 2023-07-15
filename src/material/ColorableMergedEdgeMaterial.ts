import { ShaderMaterial, UniformsLib, UniformsUtils, Vector4 } from "three";
import { IColorableMergedMaterial } from "./index.js";
import { fragment, vertex } from "./ColorableMergedEdgeMaterial.glsl.js";

export interface ColorableMergedEdgeMaterialParam {
  depthWrite?: boolean;
}
export class ColorableMergedEdgeMaterial
  extends ShaderMaterial
  implements IColorableMergedMaterial
{
  constructor(colorLength: number, param?: ColorableMergedEdgeMaterialParam) {
    super({
      vertexShader: vertex,
      fragmentShader: fragment,
    });

    this.defines = {
      INDEX: colorLength,
    };
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

  setColor(index: number, color: [number, number, number, number]) {
    const colors = this.uniforms.colors.value as Vector4[];
    colors[index].set(color[0], color[1], color[2], color[3]);
  }
}
