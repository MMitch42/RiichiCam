'use client';

import * as ort from 'onnxruntime-web';
import type { RawPrediction } from '../scoring/roboflow-parser';
import { computeLetterbox } from './letterbox';
import { decodeYoloOutput } from './decode-yolo-output';
import { CLASS_NAMES } from './tile-classes';

const MODEL_INPUT_SIZE = 640;
const PAD_VALUE = 114 / 255; // Ultralytics' default letterbox pad color, normalized

ort.env.wasm.wasmPaths = '/ort/';

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let activeModelUrl: string | null = null;

// Lazily loads (and caches) the inference session. WebGPU is tried first;
// onnxruntime-web falls back to wasm automatically if it's unavailable, and
// the wasm EP itself degrades to single-threaded execution when the page
// isn't cross-origin-isolated (no SharedArrayBuffer) — this needs
// confirming against real hardware once we have a model to load.
export function loadSession(modelUrl: string): Promise<ort.InferenceSession> {
  if (sessionPromise && activeModelUrl === modelUrl) return sessionPromise;
  activeModelUrl = modelUrl;
  sessionPromise = ort.InferenceSession.create(modelUrl, {
    executionProviders: ['webgpu', 'wasm'],
  });
  return sessionPromise;
}

interface PreprocessResult {
  tensor: ort.Tensor;
  letterbox: ReturnType<typeof computeLetterbox>;
}

function preprocess(image: CanvasImageSource, srcWidth: number, srcHeight: number): PreprocessResult {
  const letterbox = computeLetterbox(srcWidth, srcHeight, MODEL_INPUT_SIZE);
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not acquire 2D canvas context for preprocessing');

  ctx.fillStyle = `rgb(114, 114, 114)`;
  ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const drawWidth = srcWidth * letterbox.scale;
  const drawHeight = srcHeight * letterbox.scale;
  ctx.drawImage(image, letterbox.padX, letterbox.padY, drawWidth, drawHeight);

  const { data } = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const planeSize = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const chw = new Float32Array(3 * planeSize);
  for (let i = 0; i < planeSize; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    chw[i] = r;
    chw[planeSize + i] = g;
    chw[2 * planeSize + i] = b;
  }
  void PAD_VALUE; // pad color is baked into the canvas fill above, not re-applied here

  const tensor = new ort.Tensor('float32', chw, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  return { tensor, letterbox };
}

export interface DetectOptions {
  confidenceThreshold?: number;
  iouThreshold?: number;
}

// Runs on-device detection on a decoded image source. Caller is responsible
// for loading the image (e.g. via `new Image()` + await decode, or
// createImageBitmap) so this stays framework-agnostic about capture source.
export async function detectTiles(
  modelUrl: string,
  image: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  opts: DetectOptions = {},
): Promise<RawPrediction[]> {
  const session = await loadSession(modelUrl);
  const { tensor, letterbox } = preprocess(image, srcWidth, srcHeight);

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const results = await session.run({ [inputName]: tensor });
  const output = results[outputName];

  // Expected shape: [1, 4 + numClasses, numAnchors].
  const [, channels, numAnchors] = output.dims;
  const numClasses = channels - 4;
  if (numClasses !== CLASS_NAMES.length) {
    throw new Error(
      `Model output has ${numClasses} classes but ${CLASS_NAMES.length} were expected ` +
      `(${outputName} dims: ${output.dims.join('x')}). Wrong model file or stale export?`,
    );
  }

  return decodeYoloOutput(
    { data: output.data as Float32Array, numAnchors, numClasses },
    letterbox,
    opts,
  );
}

// onnxruntime-web doesn't expose which EP a session actually resolved to, so
// this reports what will be *attempted* (WebGPU preferred, wasm fallback) via
// feature detection, not a confirmed result. Useful for a debug overlay while
// validating on real devices — cross-check against actual latency/behavior.
export function preferredBackend(): 'webgpu' | 'wasm' {
  return typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm';
}

// Measured on a real phone: first inference in a session took ~30s (WASM
// runtime fetch + WebGPU shader compilation), every inference after that
// took ~200ms — faster than the Roboflow round-trip. That one-time cost is
// real but front-loadable: call this as soon as the scan UI mounts (before
// the user has taken a photo), not lazily on the first real detectTiles()
// call, so it's hidden behind however long the user spends framing their
// hand instead of sitting in front of a spinner after they press capture.
// Runs a real (dummy) inference, not just session creation — WebGPU shader
// compilation is triggered by actually executing the graph's ops, not by
// loading the model file.
export async function warmUp(modelUrl: string): Promise<void> {
  const session = await loadSession(modelUrl);
  const dummy = new ort.Tensor(
    'float32',
    new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE),
    [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE],
  );
  const inputName = session.inputNames[0];
  await session.run({ [inputName]: dummy });
}
