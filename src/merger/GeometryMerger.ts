import { BufferAttribute, type BufferGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  type ColorableMergedBody,
  type ColorableMergedBodyParam,
  type ColorableMergedEdge,
  type ColorableMergedEdgeParam,
  ColorableMergedView,
  readGeometryCount,
  type TweenableColorMap,
} from "../index.js";

/**
 * ジオメトリのマージを担当するクラス。
 * add, convert, merge の3つの手順でジオメトリをマージする。
 * マージされたジオメトリは、コンストラクタで渡されたObject3Dに返される。
 */
export class GeometryMerger<
  Option extends ColorableMergedBodyParam | ColorableMergedEdgeParam,
> {
  readonly object3D: ColorableMergedBody | ColorableMergedEdge;
  readonly option: Option;
  readonly geometries: BufferGeometry[] = [];
  private isSourceReleased = false;

  constructor(
    object3D: ColorableMergedBody | ColorableMergedEdge,
    option: Option,
  ) {
    this.object3D = object3D;
    this.option = option;
  }

  /**
   * Release the merger's references to the geometries accumulated by
   * {@link add}. Call this after the final {@link merge}; subsequent
   * {@link add} and {@link merge} calls throw.
   *
   * Ownership contract: geometries passed to {@link add} are handed over to the
   * merger, and BodyGeometryMerger mutates them in place. They are never
   * rendered after {@link merge}, so the merger holds no GPU resource for them
   * and this method does not call `dispose()`; disposing the originals, and any
   * memory still reachable from the caller, remains the caller's responsibility.
   */
  public clearSourceGeometries(): void {
    this.geometries.length = 0;
    this.isSourceReleased = true;
  }

  public async add(
    geometry: BufferGeometry,
    colorMap: TweenableColorMap,
    index: number,
  ) {
    this.assertSourceAvailable();
    const convertedGeometry = await this.convert(geometry);
    const uniformIndex = colorMap.getUniformIndex(index);

    const n = readGeometryCount(convertedGeometry);
    const attrArray = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      attrArray[i] = uniformIndex;
    }
    const attr = new BufferAttribute(attrArray, 1);
    convertedGeometry.setAttribute(ColorableMergedView.MODEL_INDEX, attr);
    this.geometries.push(convertedGeometry);
  }

  protected async convert(geometry: BufferGeometry) {
    //Override this method in child class
    return geometry;
  }

  /**
   * merge() removes object3D from its parent when geometries is empty.
   * Without this guard, a second merge() after the release would silently take
   * that branch and detach an already merged object.
   */
  private assertSourceAvailable(): void {
    if (this.isSourceReleased) {
      throw new Error(
        "GeometryMerger: source geometries were released by clearSourceGeometries(); add()/merge() are no longer allowed",
      );
    }
  }

  async merge(): Promise<void> {
    this.assertSourceAvailable();
    if (this.geometries.length === 0) {
      this.object3D.parent?.remove(this.object3D);
      return;
    }

    this.object3D.geometry = BufferGeometryUtils.mergeGeometries(
      this.geometries,
    );
  }
}
