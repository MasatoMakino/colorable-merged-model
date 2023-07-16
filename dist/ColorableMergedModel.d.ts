import { BufferGeometry, Group } from "three";
import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
} from "./index.js";
export declare class ColorableMergedModel extends Group {
  static readonly MODEL_INDEX = "MODEL_INDEX";
  readonly body?: ColorableMergedBody;
  readonly edge?: ColorableMergedEdge;
  /**
   * ジオメトリのグループIDを抽出する関数。
   * セパレーターなどの書式が変わったら、この関数を上書きしてください。
   *
   * @param name
   */
  getGeometryID: (name: string) => number;
  constructor(option: {
    bodyOption?: ColorableMergedBodyParam;
    edgeOption?: ColorableMergedEdgeParam;
  });
  addModel(geometry: BufferGeometry, id: number, type?: string): void;
  generate(): Promise<void>;
  changeColor(param: {
    bodyColor?: [number, number, number, number];
    edgeColor?: [number, number, number, number];
    id: number;
    type?: string;
  }): void;
}
//# sourceMappingURL=ColorableMergedModel.d.ts.map
