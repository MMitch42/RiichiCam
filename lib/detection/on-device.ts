'use client';

import { parsePredictions, type RawPrediction } from '../scoring/roboflow-parser';
import type { Tile, Meld } from '../scoring/types';
import { detectTiles } from './onnx-detector';
import { splitBySection, type SectionBox } from './sections';

// Wraps the on-device detector with the same response contract the old
// Roboflow-backed /api/detect route had, so /score's capture handlers didn't
// need to change their downstream state-setting logic when this replaced
// that fetch call. On-device is attempted only when `onDeviceReady` is true
// (the caller gates this on a completed warm-up — attempting it while cold
// would make the user pay the ~30s first-run cost synchronously, and /score
// already blocks scanning entirely during that window so this case mostly
// means warm-up ended in 'failed', not 'warming').
//
// There is deliberately no server-side fallback anymore. Roboflow used to
// catch on-device failures here; once the Roboflow account is gone, calling
// it would just be a network request to a dead endpoint. Both "not ready"
// and "threw during the on-device attempt" now return the same clear,
// actionable error instead, pointing at manual entry -- a real, already-
// built feature -- rather than failing silently or throwing an
// unhandled error at the caller.
const DETECTION_UNAVAILABLE_ERROR =
  "On-device detection isn't available right now. Please enter your hand manually.";

export type DetectError = { error: string };

export interface IndividualDetectResult {
  tiles: Tile[];
  rawPredictions?: RawPrediction[];
  usedOnDevice: boolean;
}

export interface GuidedDetectResult {
  hand: Tile[];
  winningTile: Tile | null;
  dora: Tile[];
  melds: Meld[];
  rawPredictions?: RawPrediction[];
  usedOnDevice: boolean;
}

function base64ToImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

// Fire-and-forget, matching the server route's after() semantics: training
// storage is non-critical and must never block or fail the detection result.
function saveTrainingImageOnDevice(
  base64: string,
  mode: string,
  sessionId: string,
  predictions: RawPrediction[],
  imageWidth: number,
  imageHeight: number,
): void {
  fetch('/api/save-training', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      meta: {
        timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
        mode,
        sessionId,
        predictions,
        imageWidth,
        imageHeight,
      },
    }),
  }).catch(() => {});
}

export interface IndividualDetectParams {
  onDeviceReady: boolean;
  modelUrl: string;
  base64: string;
  mode: string;
  save: boolean;
  sessionId: string;
  returnRawPredictions: boolean;
}

export async function detectIndividual(
  params: IndividualDetectParams,
): Promise<IndividualDetectResult | DetectError> {
  if (!params.onDeviceReady) {
    return { error: DETECTION_UNAVAILABLE_ERROR };
  }

  try {
    const img = await base64ToImage(params.base64);
    const rawPredictions = await detectTiles(params.modelUrl, img, img.naturalWidth, img.naturalHeight);
    const tiles = parsePredictions(rawPredictions);

    if (tiles.length < 1) {
      return { error: 'No tiles detected. Try better lighting or a closer shot.' };
    }
    // A safety valve against a malfunctioning detection (e.g. an unrelated
    // photo), not a real hand-size limit. A concealed hand plus called melds
    // maxes out around 17 physical tiles on the table (13 - 3 per meld,
    // + 4 per meld, up to 4 melds), so this leaves real headroom above that
    // rather than sitting right at the ceiling.
    if (tiles.length > 20) {
      return { error: 'Too many tiles detected. Try scanning hand and dora separately.' };
    }

    if (params.save) {
      saveTrainingImageOnDevice(
        params.base64, params.mode, params.sessionId, rawPredictions, img.naturalWidth, img.naturalHeight,
      );
    }

    return {
      tiles,
      rawPredictions: params.returnRawPredictions ? rawPredictions : undefined,
      usedOnDevice: true,
    };
  } catch {
    return { error: DETECTION_UNAVAILABLE_ERROR };
  }
}

export interface GuidedDetectParams {
  onDeviceReady: boolean;
  modelUrl: string;
  base64: string;
  sections: Partial<Record<'hand' | 'winning' | 'dora' | 'meld', SectionBox>>;
  isLandscape?: boolean;
  save: boolean;
  sessionId: string;
  returnRawPredictions: boolean;
}

export async function detectGuided(
  params: GuidedDetectParams,
): Promise<GuidedDetectResult | DetectError> {
  if (!params.onDeviceReady) {
    return { error: DETECTION_UNAVAILABLE_ERROR };
  }

  try {
    const img = await base64ToImage(params.base64);
    const rawPredictions = await detectTiles(params.modelUrl, img, img.naturalWidth, img.naturalHeight);
    const split = splitBySection(rawPredictions, params.sections, img.naturalWidth, img.naturalHeight);

    if (params.save) {
      saveTrainingImageOnDevice(
        params.base64, 'guided', params.sessionId, rawPredictions, img.naturalWidth, img.naturalHeight,
      );
    }

    return {
      ...split,
      rawPredictions: params.returnRawPredictions ? rawPredictions : undefined,
      usedOnDevice: true,
    };
  } catch {
    return { error: DETECTION_UNAVAILABLE_ERROR };
  }
}
