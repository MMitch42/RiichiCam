import type { RawPrediction } from '../scoring/roboflow-parser';

export interface InferenceTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Convert a visible normalized ROI into the exact pixel rectangle that Canvas
 * will crop. Lower bounds round down and upper bounds round up, so a box
 * never becomes shorter than the operator drew because of fractional pixels.
 */
export function normalizedRegionBounds(
  region: NormalizedRegion,
  sourceWidth: number,
  sourceHeight: number,
): InferenceTile {
  const clamp = (value: number, limit: number) => Math.max(0, Math.min(limit, value));
  const x1 = clamp(Math.floor(region.x * sourceWidth), sourceWidth);
  const y1 = clamp(Math.floor(region.y * sourceHeight), sourceHeight);
  const x2 = clamp(Math.ceil((region.x + region.w) * sourceWidth), sourceWidth);
  const y2 = clamp(Math.ceil((region.y + region.h) * sourceHeight), sourceHeight);
  return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
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

/**
 * Overlapping, smaller views that collectively cover a regular camera photo.
 * A hand row can be tiny inside a 4:3 photo even though the photo itself is
 * not extreme enough to trigger aspect-ratio tiling. These windows preserve
 * every source pixel while giving those tiles more model resolution.
 */
export function coverageWindows(
  width: number,
  height: number,
  windowFraction = 0.6,
  overlapFraction = 0.2,
): InferenceTile[] {
  if (width <= 0 || height <= 0) return [];
  const fraction = Math.min(Math.max(windowFraction, 0.1), 1);
  const overlap = Math.min(Math.max(overlapFraction, 0), 0.9);
  const windowWidth = Math.max(1, Math.round(width * fraction));
  const windowHeight = Math.max(1, Math.round(height * fraction));
  const starts = (fullSize: number, windowSize: number) => {
    if (windowSize >= fullSize) return [0];
    const stride = Math.max(1, Math.round(windowSize * (1 - overlap)));
    const values = Array.from(
      { length: Math.floor((fullSize - windowSize) / stride) + 1 },
      (_, index) => index * stride,
    );
    const last = fullSize - windowSize;
    if (values[values.length - 1] !== last) values.push(last);
    return values;
  };
  return starts(height, windowHeight).flatMap((y) =>
    starts(width, windowWidth).map((x) => ({ x, y, width: windowWidth, height: windowHeight })),
  );
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
