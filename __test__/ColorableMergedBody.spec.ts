import { ColorableMergedBody } from "../src";
import { testColorableMergedObjects } from "./ColorableMergedObjects";

describe("ColorableMergedBody", () => {
  const body = new ColorableMergedBody({ color: [1, 1, 1, 1] });
  testColorableMergedObjects(body, "ColorableMergedBody");
});
