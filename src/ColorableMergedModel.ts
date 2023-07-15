import { BufferGeometry, Group } from "three";
import {
  ColorableMergedBody,
  ColorableMergedBodyParam,
  ColorableMergedEdge,
  ColorableMergedEdgeParam,
} from "./index.js";

export class ColorableMergedModel extends Group {
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

  public addModel(geometry: BufferGeometry, id: number, type?: string): void {
    this.body?.addModel(geometry, id, type);
    this.edge?.addModel(geometry, id, type);
  }

  public async generate() {
    await Promise.all([this.body?.generate(), this.edge?.generate()]);
  }

  changeColor(param: {
    bodyColor?: [number, number, number, number];
    edgeColor?: [number, number, number, number];
    id: number;
    type?: string;
  }): void {
    if (param.bodyColor) {
      this.body?.colorMap.changeColor(param.bodyColor, param.id, param.type);
    }
    if (param.edgeColor) {
      this.edge?.colorMap.changeColor(param.edgeColor, param.id, param.type);
    }
  }
}
