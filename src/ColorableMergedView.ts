import { Group } from "three";
import {
  ColorableMergedBody,
  type ColorableMergedBodyParam,
  ColorableMergedEdge,
  type ColorableMergedEdgeParam,
} from "./index.js";

/**
 * 色変更アニメーションのパラメータ。
 * 変更後の色と、その色に変化するまでの時間とイージング関数を指定する。
 */
export interface ChangeColorParam {
  bodyColor?: [number, number, number, number];
  edgeColor?: [number, number, number, number];
  id: number;
  type?: string;
  easing?: (t: number) => number;
  duration?: number;
  now?: number;
}

/**
 * 色変更が可能なモデル。
 *
 * 半透明なモデルと、エッジの組み合わせで構成される。
 * それぞれに対して、色変更アニメーションができる。
 */
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

  public async merge() {
    await Promise.all([
      this.body?.geometryMerger.merge(),
      this.edge?.geometryMerger.merge(),
    ]);
  }
}
