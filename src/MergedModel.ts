import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
  ColorableMergedView,
  readGeometryCount,
} from "./index.js";
import { BufferAttribute, BufferGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * ColorableMergedBodyとColorableMergedEdgeの共通部分を抽出したクラス。
 * ジオメトリのマージを担当する。
 */
export class MergedModel<
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

  // TODO colorMapIndexを渡すのではなく、Mapとindexを渡して関数内でcolorMapIndexを計算する。
  public async addGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
    type?: string,
  ) {
    const convertedGeometry = await this.convertGeometry(geometry);

    const n = readGeometryCount(convertedGeometry);
    convertedGeometry.setAttribute(
      ColorableMergedView.MODEL_INDEX,
      new BufferAttribute(new Uint16Array(new Array(n).fill(colorMapIndex)), 1),
    );
    this.geometries.push(convertedGeometry);
  }

  protected async convertGeometry(geometry: BufferGeometry) {
    //Override this method in child class
    return geometry;
  }

  async merge(): Promise<void> {
    if (this.geometries.length === 0) return;

    this.object3D.geometry = BufferGeometryUtils.mergeGeometries(
      this.geometries,
    );
  }
}
