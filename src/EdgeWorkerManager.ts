import EventEmitter from "eventemitter3";
import { BufferGeometry } from "three";
import { EdgeGenerationResponse } from "./EdgeWorkerMessage";

interface EdgeWorkerInstance {
  worker: Worker;
  isRunning: boolean;
}

export class EdgeWorkerManager {
  static get workerURL(): string | URL {
    return EdgeWorkerManager.#workerURL;
  }
  static #workerURL: string | URL;
  static #workers: EdgeWorkerInstance[] = [];
  static emitter = new EventEmitter();

  static requestStack: { geometry: BufferGeometry; detail: number }[] = [];

  public static setWorkerURL(url: string | URL): void {
    if (this.#workerURL) throw new Error("Worker URL is already set.");

    this.#workerURL = url;
    const nativeProcess = window.navigator.hardwareConcurrency ?? 2;

    for (let i = 0; i < nativeProcess; i++) {
      const urlString = typeof url === "string" ? url : url.toString();
      const worker = new Worker(urlString, { name: `edge_${i}` });
      const workerInstance = {
        worker,
        isRunning: false,
      };
      this.#workers.push(workerInstance);
      worker.addEventListener(
        "message",
        (e: MessageEvent<EdgeGenerationResponse>) => {
          workerInstance.isRunning = false;
          this.shiftRequest();
          this.emitter.emit("response", e.data);
        },
      );
    }
  }

  static request(geometry: BufferGeometry, detail: number): void {
    if (!this.workerURL) return;
    this.requestStack.push({ geometry, detail });
    this.shiftRequest();
  }

  private static shiftRequest(): void {
    const suspendedWorkers = this.#workers.filter(
      (worker) => !worker.isRunning,
    );
    if (suspendedWorkers.length === 0) return;

    suspendedWorkers.forEach((worker) => {
      const request = this.requestStack.shift();
      if (!request) return;

      const { geometry, detail } = request;
      const copyAttribute = (name: string) => {
        const attr = geometry.getAttribute(name);
        return attr.array.slice() as Float32Array;
      };
      const message = {
        position: copyAttribute("position"),
        normal: copyAttribute("normal"),
        index: (
          geometry.getIndex()!.array as Uint16Array | Uint32Array
        ).slice(),
        detail,
        geometryID: geometry.uuid,
      };
      worker.worker.postMessage(message, [
        message.position.buffer,
        message.normal.buffer,
        message.index.buffer,
      ]);
      worker.isRunning = true;
    });
  }
}
