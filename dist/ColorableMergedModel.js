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
import { Group } from "three";
import { ColorableMergedBody, ColorableMergedEdge } from "./index.js";
export class ColorableMergedModel extends Group {
  constructor(option) {
    super();
    /**
     * ジオメトリのグループIDを抽出する関数。
     * セパレーターなどの書式が変わったら、この関数を上書きしてください。
     *
     * @param name
     */
    this.getGeometryID = (name) => {
      const match = name.match(/.*_.*_(\d*)/);
      if (match == null) throw new Error(`Invalid name: ${name}`);
      return Number(match[1]);
    };
    if (option.bodyOption != null) {
      this.body = new ColorableMergedBody(option.bodyOption);
      this.add(this.body);
    }
    if (option.edgeOption != null) {
      this.edge = new ColorableMergedEdge(option.edgeOption);
      this.add(this.edge);
    }
  }
  addModel(geometry, id, type) {
    var _a, _b;
    (_a = this.body) === null || _a === void 0
      ? void 0
      : _a.addModel(geometry, id, type);
    (_b = this.edge) === null || _b === void 0
      ? void 0
      : _b.addModel(geometry, id, type);
  }
  generate() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
      yield Promise.all([
        (_a = this.body) === null || _a === void 0 ? void 0 : _a.generate(),
        (_b = this.edge) === null || _b === void 0 ? void 0 : _b.generate(),
      ]);
    });
  }
  changeColor(param) {
    var _a, _b;
    if (param.bodyColor) {
      (_a = this.body) === null || _a === void 0
        ? void 0
        : _a.colorMap.changeColor(param.bodyColor, param.id, {
            type: param.type,
            duration: param.duration,
            easing: param.easing,
            now: param.now,
          });
    }
    if (param.edgeColor) {
      (_b = this.edge) === null || _b === void 0
        ? void 0
        : _b.colorMap.changeColor(param.edgeColor, param.id, {
            type: param.type,
            duration: param.duration,
            easing: param.easing,
            now: param.now,
          });
    }
  }
}
ColorableMergedModel.MODEL_INDEX = "MODEL_INDEX";
