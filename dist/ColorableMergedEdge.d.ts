import { BufferGeometry, LineSegments } from "three";
import {
  TweenableColorMap,
  ColorableMergedEdgeMaterialParam,
} from "./index.js";
export interface ColorableMergedEdgeParam {
  edgeDetail?: number;
  color: [number, number, number, number];
  materialSetting?: ColorableMergedEdgeMaterialParam;
}
export declare class ColorableMergedEdge extends LineSegments {
  readonly option: ColorableMergedEdgeParam;
  readonly geometries: BufferGeometry[];
  readonly geometryIDSet: Set<string>;
  readonly colorMap: TweenableColorMap;
  constructor(option: ColorableMergedEdgeParam);
  addModel(geometry: BufferGeometry, id: number, type?: string): void;
  generate(): Promise<void>;
}
//# sourceMappingURL=ColorableMergedEdge.d.ts.map
