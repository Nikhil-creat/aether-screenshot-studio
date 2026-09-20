import * as ort from "onnxruntime-web";

// Privacy-first: run segmentation in-browser. Prefers WebNN, then WebGPU, then WASM.
export async function loadSegmenter(url = "/models/ui-seg.onnx") {
  return ort.InferenceSession.create(url, { executionProviders: ["webnn", "webgpu", "wasm"] });
}

export async function segment(session: ort.InferenceSession, rgb: Float32Array, w: number, h: number) {
  const input = new ort.Tensor("float32", rgb, [1, 3, h, w]);
  const out = await session.run({ input });
  return out[Object.keys(out)[0]]; // [1, C, H, W] logits
}
