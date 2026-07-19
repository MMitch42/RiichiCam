'use client';

import { parsePredictions, type RawPrediction } from '../scoring/roboflow-parser';
import type { Tile } from '../scoring/types';
import { detectTiles } from './onnx-detector';
import { splitBySection, type SectionBox } from './sections';

// Wraps the on-device detector with the exact request/response contract
// app/api/detect/route.ts already has, so /score's capture handlers can swap
// their fetch('/api/detect') call for one of these without touching any
// downstream state-setting logic. On-device is attempted only when
// `onDeviceReady` is true (the caller should gate this on a completed
// warm-up — attempting it while cold would make the user pay the ~30s
// first-run cost synchronously) and falls back to the same Roboflow request
// used today on ANY thrown error (unsupported backend, model fetch failure,
// unexpected runtime error) so a bad on-device run never dead-ends the user.
// A legitimate detection result (e.g. zero tiles found) is NOT treated as a
// failure to fall back from -- that's a normal outcome either backend could
// produce for a bad photo, so retrying it against Roboflow would just burn
// an API call for the same likely answer while working against the reason
// we're moving off it.

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
  if (params.onDeviceReady) {
    try {
      const img = await base64ToImage(params.base64);
      const rawPredictions = await detectTiles(params.modelUrl, img, img.naturalWidth, img.naturalHeight);
      const tiles = parsePredictions(rawPredictions);

      if (tiles.length < 1) {
        return { error: 'No tiles detected. Try better lighting or a closer shot.' };
      }
      if (tiles.length > 18) {
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
      // Falls through to the Roboflow request below.
    }
  }

  try {
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: params.base64,
        mode: params.mode,
        save: params.save,
        sessionId: params.sessionId,
        returnRawPredictions: params.returnRawPredictions,
      }),
    });
    const data = await res.json();
    if (data.error) return { error: data.error };
    return { tiles: data.tiles, rawPredictions: data.rawPredictions, usedOnDevice: false };
  } catch {
    return { error: 'Detection failed. Check your connection and try again.' };
  }
}

export interface GuidedDetectParams {
  onDeviceReady: boolean;
  modelUrl: string;
  base64: string;
  sections: Partial<Record<'hand' | 'winning' | 'dora', SectionBox>>;
  isLandscape?: boolean;
  save: boolean;
  sessionId: string;
  returnRawPredictions: boolean;
}

export async function detectGuided(
  params: GuidedDetectParams,
): Promise<GuidedDetectResult | DetectError> {
  if (params.onDeviceReady) {
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
      // Falls through to the Roboflow request below.
    }
  }

  try {
    const res = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: params.base64,
        mode: 'guided',
        sections: params.sections,
        isLandscape: params.isLandscape,
        save: params.save,
        sessionId: params.sessionId,
        returnRawPredictions: params.returnRawPredictions,
      }),
    });
    const result = await res.json();
    if (result.error) return { error: result.error };
    return {
      hand: result.hand ?? [],
      winningTile: result.winningTile ?? null,
      dora: result.dora ?? [],
      rawPredictions: result.rawPredictions,
      usedOnDevice: false,
    };
  } catch {
    return { error: 'Detection failed. Check your connection and try again.' };
  }
}
