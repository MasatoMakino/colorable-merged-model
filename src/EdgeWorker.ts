import { BufferAttribute, BufferGeometry, EdgesGeometry } from "three";
import {
  EdgeGenerationRequest,
  EdgeGenerationResponse,
} from "./EdgeWorkerMessage.js";

type MessageEvent = {
  data: EdgeGenerationRequest;
};

self.onmessage = (e: MessageEvent) => {
  const bufferGeometry = new BufferGeometry();
  bufferGeometry.setAttribute(
    "position",
    new BufferAttribute(e.data.position, 3),
  );
  bufferGeometry.setAttribute("normal", new BufferAttribute(e.data.normal, 3));
  bufferGeometry.setIndex(new BufferAttribute(e.data.index, 1));
  const edgesGeometry = new EdgesGeometry(bufferGeometry, e.data.detail);
  const buffer = (edgesGeometry.getAttribute("position") as BufferAttribute)
    .array as Float32Array;

  const message: EdgeGenerationResponse = {
    buffer,
    geometryID: e.data.geometryID,
  };
  self.postMessage(message);
};
