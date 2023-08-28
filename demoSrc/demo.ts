import { ColorableMergedView } from "../";
import { generateModel } from "./GenarateModel";
import { generateScene } from "./GenerateScene";
import { ColorSwitcher } from "./ColorSwitcher";

const onDomContentsLoaded = async () => {
  const scene = generateScene();
  const model: ColorableMergedView = await generateModel();
  scene.add(model);
  new ColorSwitcher(model);
};

window.onload = onDomContentsLoaded;
