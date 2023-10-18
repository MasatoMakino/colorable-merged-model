import { ColorableMergedView } from "../src/index.js";

export class ColorSwitcher {
  private isOn: boolean = true;

  constructor(private model: ColorableMergedView) {
    setInterval(this.switchColor, 3000);
    this.switchColor();
  }

  private switchColor = () => {
    this.isOn = !this.isOn;

    const OnBodyColor: [number, number, number, number] = [1, 1, 1, 0.2];
    const OffBodyColor01: [number, number, number, number] = [1, 0, 0, 0.2];
    const OffBodyColor02: [number, number, number, number] = [0, 1, 0, 0.2];

    const OnEdgeColor: [number, number, number, number] = [1, 1, 1, 0.8];
    const OffEdgeColor01: [number, number, number, number] = [1, 0, 0, 0.8];
    const OffEdgeColor02: [number, number, number, number] = [0, 1, 0, 0.8];

    this.model.changeColor({
      bodyColor: this.isOn ? OnBodyColor : OffBodyColor01,
      edgeColor: this.isOn ? OnEdgeColor : OffEdgeColor01,
      id: 1,
    });

    this.model.changeColor({
      bodyColor: this.isOn ? OnBodyColor : OffBodyColor02,
      edgeColor: this.isOn ? OnEdgeColor : OffEdgeColor02,
      id: -1,
    });
  };
}
