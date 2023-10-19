import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
  ColorableMergedView,
  readGeometryCount,
  TweenableColorMap,
} from "./index.js";
import { BufferAttribute, BufferGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
export class MergedModel<
  Option extends ColorableMergedBodyParam | ColorableMergedEdgeParam,
> {
  readonly object3D: ColorableMergedBody | ColorableMergedEdge;
  readonly option: Option;
  readonly geometries: BufferGeometry[] = [];
  readonly colorMap: TweenableColorMap;

  constructor(
    object3D: ColorableMergedBody | ColorableMergedEdge,
    option: Option,
  ) {
    this.object3D = object3D;
    this.option = option;
    this.colorMap = new TweenableColorMap(object3D);
  }

  public async addGeometry(
    geometry: BufferGeometry,
    id: number,
    type?: string,
  ) {
    this.colorMap.addColor(this.option.color, id, type);
    const colorMapIndex = this.colorMap.getIndex(id, type)!;

    const convertedGeometry = await this.convertGeometry(
      geometry,
      colorMapIndex,
    );

    const n = readGeometryCount(convertedGeometry);
    convertedGeometry.setAttribute(
      ColorableMergedView.MODEL_INDEX,
      new BufferAttribute(new Uint16Array(new Array(n).fill(colorMapIndex)), 1),
    );
    this.geometries.push(convertedGeometry);
  }

  protected async convertGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
  ) {
    //Override this method in child class
    return geometry;
  }

  async merge(): Promise<void> {
    if (this.geometries.length === 0) return;

    this.object3D.geometry = BufferGeometryUtils.mergeGeometries(
      this.geometries,
    );
    this.colorMap.forceUpdateColorAttribute();
  }
}
