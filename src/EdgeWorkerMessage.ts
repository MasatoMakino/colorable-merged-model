export type EdgeGenerationRequest = {
  position: Float32Array;
  normal: Float32Array;
  index: Uint16Array | Uint32Array;
  geometryID: string;
  detail?: number;
};

export type EdgeGenerationResponse = {
  buffer: Float32Array;
  geometryID: string;
};
