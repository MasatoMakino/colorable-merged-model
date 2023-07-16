var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
import { BufferAttribute, EdgesGeometry, LineSegments } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  TweenableColorMap,
  ColorableMergedModel,
  readGeometryCount,
  ColorableMergedEdgeMaterial,
} from "./index.js";
export class ColorableMergedEdge extends LineSegments {
  constructor(option) {
    var _a;
    super();
    this.geometries = [];
    this.geometryIDSet = new Set();
    this.colorMap = new TweenableColorMap(this);
    this.option = option;
    this.option.edgeDetail =
      (_a = option.edgeDetail) !== null && _a !== void 0 ? _a : 7;
  }
  addModel(geometry, id, type) {
    const uniqueID = TweenableColorMap.getColorMapKey(id, type);
    this.geometryIDSet.add(uniqueID);
    const index = [...this.geometryIDSet].indexOf(uniqueID);
    const edge = new EdgesGeometry(geometry, this.option.edgeDetail);
    const n = readGeometryCount(edge);
    edge.setAttribute(
      ColorableMergedModel.MODEL_INDEX,
      new BufferAttribute(new Uint16Array(n).fill(index), 1),
    );
    this.geometries.push(edge);
    this.colorMap.addColor(this.option.color, id, type);
  }
  generate() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.geometries.length === 0) return;
      this.geometry = BufferGeometryUtils.mergeGeometries(this.geometries);
      this.material = new ColorableMergedEdgeMaterial(
        this.geometryIDSet.size,
        this.option.materialSetting,
      );
      this.colorMap.forceUpdateColorAttribute();
    });
  }
}
