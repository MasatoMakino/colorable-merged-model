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
import { BufferAttribute, Mesh } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ColorableMergedModel,
  readGeometryCount,
  TweenableColorMap,
  ColorableMergedBodyMaterial,
} from "./index.js";
export class ColorableMergedBody extends Mesh {
  constructor(option) {
    super();
    this.geometries = [];
    this.geometryIDSet = new Set();
    this.colorMap = new TweenableColorMap(this);
    this.option = option;
  }
  addModel(geometry, id, type) {
    const n = readGeometryCount(geometry);
    const uniqueID = TweenableColorMap.getColorMapKey(id, type);
    this.geometryIDSet.add(uniqueID);
    const index = [...this.geometryIDSet].indexOf(uniqueID);
    geometry.setAttribute(
      ColorableMergedModel.MODEL_INDEX,
      new BufferAttribute(new Uint16Array(new Array(n).fill(index)), 1),
    );
    geometry.deleteAttribute("uv");
    this.geometries.push(geometry);
    this.colorMap.addColor(this.option.color, id, type);
  }
  generate() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this.geometries.length === 0) return;
      this.geometry = BufferGeometryUtils.mergeGeometries(this.geometries);
      this.material = new ColorableMergedBodyMaterial(
        this.geometryIDSet.size,
        this.option.materialSetting,
      );
      this.colorMap.forceUpdateColorAttribute();
    });
  }
}
