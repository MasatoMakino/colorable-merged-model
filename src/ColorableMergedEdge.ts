import { LineSegments } from "three";
import { EdgeGeometryMerger } from "./index.js";
import {
  assertTableCapacityFactor,
  type TableCapacityFactor,
} from "./TableCapacityFactor.js";

export interface ColorableMergedEdgeParam {
  edgeDetail?: number;
  color: [number, number, number, number];
  useFastEdgesGeometry?: boolean;
  /**
   * Passed to FastEdgesGeometry as `options.tableCapacityFactor`. It has no
   * effect unless `useFastEdgesGeometry` is true, but an invalid value throws
   * at construction either way.
   */
  tableCapacityFactor?: TableCapacityFactor;
}

export class ColorableMergedEdge extends LineSegments {
  readonly geometryMerger: EdgeGeometryMerger;
  constructor(option: ColorableMergedEdgeParam) {
    super();
    option.edgeDetail = option.edgeDetail ?? 7;
    if (option.tableCapacityFactor !== undefined) {
      assertTableCapacityFactor(option.tableCapacityFactor);
    }
    this.geometryMerger = new EdgeGeometryMerger(this, option);
  }
}
