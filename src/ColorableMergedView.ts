import { BufferGeometry, Group } from "three";
import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
} from "./index.js";

export interface ChangeColorParam {
  bodyColor?: [number, number, number, number];
  edgeColor?: [number, number, number, number];
  id: number;
  type?: string;
  easing?: (t: number) => number;
  duration?: number;
  now?: number;
}
export class ColorableMergedView extends Group {
  static readonly MODEL_INDEX = "MODEL_INDEX";

  readonly body?: ColorableMergedBody;
  readonly edge?: ColorableMergedEdge;

  /**
   * ジオメトリのグループIDを抽出する関数。
   * セパレーターなどの書式が変わったら、この関数を上書きしてください。
   *
   * @param name
   */
  public getGeometryID = (name: string): number => {
    const match = name.match(/.*_.*_(\d*)/);
    if (match == null) throw new Error(`Invalid name: ${name}`);
    return Number(match[1]);
  };

  constructor(option: {
    bodyOption?: ColorableMergedBodyParam;
    edgeOption?: ColorableMergedEdgeParam;
  }) {
    super();

    if (option.bodyOption != null) {
      this.body = new ColorableMergedBody(option.bodyOption);
      this.add(this.body);
    }
    if (option.edgeOption != null) {
      this.edge = new ColorableMergedEdge(option.edgeOption);
      this.add(this.edge);
    }
  }

  // TODO 廃止 bodyとedgeに直接マージする。
  public async addGeometry(
    geometry: BufferGeometry,
    id: number,
    type?: string,
  ) {
    await Promise.all([
      this.body?.model.addGeometry(geometry, id, type),
      this.edge?.model.addGeometry(geometry, id, type),
    ]);
  }

  public async merge() {
    await Promise.all([this.body?.model.merge(), this.edge?.model.merge()]);
  }
}
