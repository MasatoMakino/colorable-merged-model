import { BufferGeometry, Mesh } from "three";
import {
  TweenableColorMap,
  ColorableMergedBodyMaterialParam,
} from "./index.js";
export interface ColorableMergedBodyParam {
  color: [number, number, number, number];
  materialSetting?: ColorableMergedBodyMaterialParam;
}
export declare class ColorableMergedBody extends Mesh {
  readonly option: ColorableMergedBodyParam;
  readonly geometries: BufferGeometry[];
  readonly geometryIDSet: Set<string>;
  readonly colorMap: TweenableColorMap;
  constructor(option: ColorableMergedBodyParam);
  addModel(geometry: BufferGeometry, id: number, type?: string): void;
  generate(): Promise<void>;
}
//# sourceMappingURL=ColorableMergedBody.d.ts.map
