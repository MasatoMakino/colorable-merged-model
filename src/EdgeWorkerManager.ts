import EventEmitter from "eventemitter3";
import { BufferGeometry } from "three";
import {
  EdgeGenerationRequest,
  EdgeGenerationResponse,
} from "./EdgeWorkerMessage";

interface EdgeWorkerInstance {
  worker: Worker;
  isRunning: boolean;
}

interface EdgeRequest {
  geometry: BufferGeometry;
  detail: number;
}

export class EdgeWorkerManager {
  static get workerURL(): string | URL {
    return EdgeWorkerManager.#workerURL;
  }
  static #workerURL: string | URL;
  static #workers: EdgeWorkerInstance[] = [];
  static emitter = new EventEmitter();

  static requestStack: EdgeRequest[] = [];

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

      const message = EdgeWorkerManager.convertRequestToMessage(request);
      worker.worker.postMessage(message, [
        message.position.buffer,
        message.normal.buffer,
        message.index.buffer,
      ]);
      worker.isRunning = true;
    });
  }

  static convertRequestToMessage(request: EdgeRequest): EdgeGenerationRequest {
    const { geometry, detail } = request;
    const copyAttribute = (name: string) => {
      const attr = geometry.getAttribute(name);
      return attr.array.slice() as Float32Array;
    };
    return {
      position: copyAttribute("position"),
      normal: copyAttribute("normal"),
      index: (geometry.getIndex()!.array as Uint16Array | Uint32Array).slice(),
      detail,
      geometryID: geometry.uuid,
    };
  }
}
