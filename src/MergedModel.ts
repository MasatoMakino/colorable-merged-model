import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
  ColorableMergedBodyMaterial,
  ColorableMergedEdgeMaterial,
  TweenableColorMap,
  readGeometryCount,
  ColorableMergedView,
} from "./index.js";
import { BufferAttribute, BufferGeometry, EdgesGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export class MergedModel<
  Option extends ColorableMergedBodyParam | ColorableMergedEdgeParam,
> {
  readonly object3D: ColorableMergedBody | ColorableMergedEdge;
  readonly option: Option;
  readonly geometries: BufferGeometry[] = [];
  readonly geometryIDSet: Set<string> = new Set();
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
    const uniqueID = TweenableColorMap.getColorMapKey(id, type);
    this.geometryIDSet.add(uniqueID);
    const colorMapIndex = [...this.geometryIDSet].indexOf(uniqueID);
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

    this.colorMap.addColor(this.option.color, id, type);
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
    this.createMaterial();
    this.colorMap.forceUpdateColorAttribute();
  }

  protected createMaterial() {
    //Override this method in child class
  }
}

export class MergedBody extends MergedModel<ColorableMergedBodyParam> {
  protected override createMaterial() {
    this.object3D.material = new ColorableMergedBodyMaterial(
      this.geometryIDSet.size,
      this.option.materialSetting,
    );
  }
  protected override async convertGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
  ) {
    geometry.deleteAttribute("uv");
    return geometry;
  }
}

export class MergedEdge extends MergedModel<ColorableMergedEdgeParam> {
  protected override createMaterial() {
    this.object3D.material = new ColorableMergedEdgeMaterial(
      this.geometryIDSet.size,
      this.option.materialSetting,
    );
  }

  protected override async convertGeometry(
    geometry: BufferGeometry,
    colorMapIndex: number,
  ) {
    return new EdgesGeometry(geometry, this.option.edgeDetail);
  }
}
