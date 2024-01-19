import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
  ColorableMergedView,
  readGeometryCount,
  TweenableColorMap,
} from "../index.js";
import { BufferAttribute, BufferGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * ジオメトリのマージを担当するクラス。
 * add, convert, merge の3つの手順でジオメトリをマージする。
 * マージされたジオメトリは、コンストラクタで渡されたObject3Dに返される。
 */
export class GeometryMerger<
  Option extends ColorableMergedBodyParam | ColorableMergedEdgeParam,
> {
  readonly object3D: ColorableMergedBody | ColorableMergedEdge;
  readonly option: Option;
  readonly geometries: BufferGeometry[] = [];

  constructor(
    object3D: ColorableMergedBody | ColorableMergedEdge,
    option: Option,
  ) {
    this.object3D = object3D;
    this.option = option;
  }

  public async add(
    geometry: BufferGeometry,
    colorMap: TweenableColorMap,
    index: number,
  ) {
    const convertedGeometry = await this.convert(geometry);
    const uniformIndex = colorMap.getUniformIndex(index);

    const n = readGeometryCount(convertedGeometry);
    convertedGeometry.setAttribute(
      ColorableMergedView.MODEL_INDEX,
      new BufferAttribute(new Uint16Array(new Array(n).fill(uniformIndex)), 1),
    );
    this.geometries.push(convertedGeometry);
  }

  protected async convert(geometry: BufferGeometry) {
    //Override this method in child class
    return geometry;
  }

  async merge(): Promise<void> {
    if (this.geometries.length === 0) {
      this.object3D.parent?.remove(this.object3D);
      return;
    }

    this.object3D.geometry = BufferGeometryUtils.mergeGeometries(
      this.geometries,
    );
  }
}
