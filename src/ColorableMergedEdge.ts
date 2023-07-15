import {
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  LineSegments,
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TweenableColorMap } from "./TweenableColorMap";
import { ColorableMergedModel } from "./ColorableMergedModel";
import { readGeometryCount } from "./MergedModelUtil";
import {
  ColorableMergedEdgeMaterial,
  ColorableMergedEdgeMaterialParam,
} from "./material";

export interface ColorableMergedEdgeParam {
  edgeDetail?: number;
  color: [number, number, number, number];
  materialSetting?: ColorableMergedEdgeMaterialParam;
}
export class ColorableMergedEdge extends LineSegments {
  readonly option: ColorableMergedEdgeParam;
  readonly geometries: BufferGeometry[] = [];
  readonly geometryIDSet: Set<string> = new Set();
  readonly colorMap = new TweenableColorMap(this);

  constructor(option: ColorableMergedEdgeParam) {
    super();
    this.option = option;
    this.option.edgeDetail = option.edgeDetail ?? 7;
  }

  public addModel(
    geometry: BufferGeometry,
    id: number,
    type?: string
  ): void {

    const uniqueID = TweenableColorMap.getColorMapKey(id, type);
    this.geometryIDSet.add(uniqueID);
    const index = [...this.geometryIDSet].indexOf(uniqueID);

    const edge = new EdgesGeometry(geometry, this.option.edgeDetail);
    const n = readGeometryCount(edge);
    edge.setAttribute(
      ColorableMergedModel.MODEL_INDEX,
      new BufferAttribute(new Uint16Array(n).fill(index), 1)
    );
    this.geometries.push(edge);

    this.colorMap.addColor(this.option.color, id, type);
  }

  async generate(): Promise<void> {

    if (this.geometries.length === 0) return;

    this.geometry = BufferGeometryUtils.mergeGeometries(this.geometries);
    this.material = new ColorableMergedEdgeMaterial(
      this.geometryIDSet.size,
      this.option.materialSetting
    );

    this.colorMap.forceUpdateColorAttribute();
  }
}
