import { BufferAttribute, BufferGeometry, Mesh } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ColorableMergedModel } from "./ColorableMergedModel";
import { readGeometryCount } from "./MergedModelUtil";
import { TweenableColorMap } from "./TweenableColorMap";
import {
  ColorableMergedBodyMaterial,
  ColorableMergedBodyMaterialParam,
} from "./material";

export interface ColorableMergedBodyParam {
  color: [number, number, number, number];
  materialSetting?: ColorableMergedBodyMaterialParam;
}
export class ColorableMergedBody extends Mesh {
  readonly option: ColorableMergedBodyParam;
  readonly geometries: BufferGeometry[] = [];
  readonly geometryIDSet: Set<string> = new Set();

  readonly colorMap = new TweenableColorMap(this);

  constructor(option: ColorableMergedBodyParam) {
    super();
    this.option = option;
  }

  public addModel(
    geometry: BufferGeometry,
    id: number,
    type?: string
  ): void {
    const n = readGeometryCount(geometry);

    const uniqueID = TweenableColorMap.getColorMapKey(id, type);
    this.geometryIDSet.add(uniqueID);
    const index = [...this.geometryIDSet].indexOf(uniqueID);

    geometry.setAttribute(
      ColorableMergedModel.MODEL_INDEX,
      new BufferAttribute(
        new Uint16Array(new Array(n).fill(index)),
        1
      )
    );
    geometry.deleteAttribute("uv");
    this.geometries.push(geometry);

    this.colorMap.addColor(this.option.color, id, type);
  }

  async generate(): Promise<void> {

    if( this.geometries.length === 0 )  return;

    this.geometry = BufferGeometryUtils.mergeGeometries(this.geometries);
    this.material = new ColorableMergedBodyMaterial(
      this.geometryIDSet.size,
      this.option.materialSetting
    );
    this.colorMap.forceUpdateColorAttribute();
  }
}
