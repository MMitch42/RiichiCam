import type { RawPrediction } from '../scoring/roboflow-parser';

export interface InferenceTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Break an extreme-aspect image into overlapping windows before it is
 * letterboxed into the model's square input. A long hand row otherwise gets
 * compressed into a thin strip and loses the detail needed to read each tile.
 */
export function inferenceTiles(
  width: number,
  height: number,
  maxAspectRatio = 2,
  overlapFraction = 0.2,
): InferenceTile[] {
  if (width <= 0 || height <= 0 || maxAspectRatio <= 1) {
    return [{ x: 0, y: 0, width, height }];
  }
  const overlap = Math.min(Math.max(overlapFraction, 0), 0.9);
  const horizontal = width > height;
  const longSide = horizontal ? width : height;
  const shortSide = horizontal ? height : width;
  if (longSide / shortSide <= maxAspectRatio) return [{ x: 0, y: 0, width, height }];

  const tileLength = Math.min(longSide, Math.max(1, Math.round(shortSide * maxAspectRatio)));
  const stride = Math.max(1, Math.round(tileLength * (1 - overlap)));
  const starts = Array.from({ length: Math.floor((longSide - tileLength) / stride) + 1 }, (_, index) => index * stride);
  const lastStart = longSide - tileLength;
  if (starts[starts.length - 1] !== lastStart) starts.push(lastStart);

  return starts.map((start) => horizontal
    ? { x: start, y: 0, width: tileLength, height }
    : { x: 0, y: start, width, height: tileLength });
}

function iou(a: RawPrediction, b: RawPrediction): number {
  const ax1 = a.x - a.width / 2, ay1 = a.y - a.height / 2;
  const ax2 = a.x + a.width / 2, ay2 = a.y + a.height / 2;
  const bx1 = b.x - b.width / 2, by1 = b.y - b.height / 2;
  const bx2 = b.x + b.width / 2, by2 = b.y + b.height / 2;
  const intersectionWidth = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const intersectionHeight = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const intersection = intersectionWidth * intersectionHeight;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Remove duplicate proposals created where adjacent inference tiles overlap. */
export function mergeTiledPredictions(
  predictions: RawPrediction[],
  iouThreshold: number,
): RawPrediction[] {
  const kept: RawPrediction[] = [];
  for (const prediction of [...predictions].sort((a, b) => b.confidence - a.confidence)) {
    if (!kept.some((existing) => existing.class === prediction.class && iou(existing, prediction) > iouThreshold)) {
      kept.push(prediction);
    }
  }
  return kept;
}
