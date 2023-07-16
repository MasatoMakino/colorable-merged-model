import { TweenableColor } from "@masatomakino/tweenable-color";
import { EventEmitter } from "eventemitter3";
import { ColorableMergedBody, ColorableMergedEdge } from "./index.js";
export declare class TweenableColorMap extends EventEmitter {
  private model;
  readonly colors: Map<string, TweenableColor>;
  constructor(model: ColorableMergedEdge | ColorableMergedBody);
  static getColorMapKey(id: number, type?: string): string;
  addColor(
    defaultColor: [number, number, number, number],
    id: number,
    type?: string,
  ): void;
  protected set(color: TweenableColor, id: number, type?: string): void;
  get(id: number, type?: string): TweenableColor | undefined;
  /**
   * 指定されたジオメトリの色を変更する
   * @param id
   * @param color
   * @param type
   */
  changeColor(
    color: [number, number, number, number],
    id: number,
    type?: string,
  ): void;
  private needUpdateColors;
  private onChangedColor;
  private updateColorAttribute;
  forceUpdateColorAttribute: () => void;
}
//# sourceMappingURL=TweenableColorMap.d.ts.map
