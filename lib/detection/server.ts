'use client';

import { parsePredictions, type RawPrediction } from '../scoring/roboflow-parser';
import type { Meld, Tile } from '../scoring/types';
import { splitBySection, type SectionBox } from './sections';

export type DetectError = { error: string };

export interface IndividualDetectResult {
  tiles: Tile[];
  rawPredictions?: RawPrediction[];
  usedServer: true;
}

export interface GuidedDetectResult {
  hand: Tile[];
  winningTile: Tile | null;
  dora: Tile[];
  melds: Meld[];
  rawPredictions?: RawPrediction[];
  usedServer: true;
}

export interface IndividualDetectParams {
  base64: string;
  mode: string;
  save: boolean;
  sessionId: string;
  returnRawPredictions: boolean;
}

export interface GuidedDetectParams {
  base64: string;
  sections: Partial<Record<'hand' | 'winning' | 'dora' | 'meld', SectionBox>>;
  save: boolean;
  sessionId: string;
  returnRawPredictions: boolean;
}

interface ServerDetectionResponse {
  image?: { width?: unknown; height?: unknown };
  predictions?: unknown;
}

const SERVER_UNAVAILABLE_ERROR =
  'The scanner is unavailable right now. Please enter your hand manually.';

function saveTrainingImage(
  base64: string,
  mode: string,
  sessionId: string,
  predictions: RawPrediction[],
  imageWidth: number,
  imageHeight: number,
): void {
  fetch('/api/save-training', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

function isPrediction(value: unknown): value is RawPrediction {
  if (!value || typeof value !== 'object') return false;
  const prediction = value as Record<string, unknown>;
  return (
    typeof prediction.class === 'string' &&
    typeof prediction.confidence === 'number' &&
    typeof prediction.x === 'number' &&
    typeof prediction.y === 'number' &&
    typeof prediction.width === 'number' &&
    typeof prediction.height === 'number'
  );
}

async function requestPredictions(base64: string): Promise<{
  predictions: RawPrediction[];
  width: number;
  height: number;
} | DetectError> {
  try {
    const response = await fetch('/api/detect-server', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });
    if (!response.ok) return { error: SERVER_UNAVAILABLE_ERROR };

    const data = (await response.json()) as ServerDetectionResponse;
    if (
      !Array.isArray(data.predictions) ||
      !data.predictions.every(isPrediction) ||
      typeof data.image?.width !== 'number' ||
      typeof data.image?.height !== 'number' ||
      data.image.width <= 0 ||
      data.image.height <= 0
    ) {
      return { error: SERVER_UNAVAILABLE_ERROR };
    }
    return { predictions: data.predictions, width: data.image.width, height: data.image.height };
  } catch {
    return { error: SERVER_UNAVAILABLE_ERROR };
  }
}

export async function detectIndividual(
  params: IndividualDetectParams,
): Promise<IndividualDetectResult | DetectError> {
  const result = await requestPredictions(params.base64);
  if ('error' in result) return result;

  const tiles = parsePredictions(result.predictions);
  if (tiles.length < 1) {
    return { error: 'No tiles detected. Try better lighting or a closer shot.' };
  }
  if (tiles.length > 20) {
    return { error: 'Too many tiles detected. Try scanning hand and dora separately.' };
  }
  if (params.save) {
    saveTrainingImage(
      params.base64,
      params.mode,
      params.sessionId,
      result.predictions,
      result.width,
      result.height,
    );
  }
  return {
    tiles,
    rawPredictions: params.returnRawPredictions ? result.predictions : undefined,
    usedServer: true,
  };
}

export async function detectGuided(
  params: GuidedDetectParams,
): Promise<GuidedDetectResult | DetectError> {
  const result = await requestPredictions(params.base64);
  if ('error' in result) return result;

  if (params.save) {
    saveTrainingImage(
      params.base64,
      'guided',
      params.sessionId,
      result.predictions,
      result.width,
      result.height,
    );
  }

  return {
    ...splitBySection(result.predictions, params.sections, result.width, result.height),
    rawPredictions: params.returnRawPredictions ? result.predictions : undefined,
    usedServer: true,
  };
}
