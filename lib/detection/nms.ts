import type { Box } from './letterbox';

export interface ScoredBox extends Box {
  score: number;
  classIndex: number;
}

function toCorners(box: Box): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: box.x - box.width / 2,
    y1: box.y - box.height / 2,
    x2: box.x + box.width / 2,
    y2: box.y + box.height / 2,
  };
}

function iou(a: Box, b: Box): number {
  const ca = toCorners(a);
  const cb = toCorners(b);
  const ix1 = Math.max(ca.x1, cb.x1);
  const iy1 = Math.max(ca.y1, cb.y1);
  const ix2 = Math.min(ca.x2, cb.x2);
  const iy2 = Math.min(ca.y2, cb.y2);
  const interW = Math.max(0, ix2 - ix1);
  const interH = Math.max(0, iy2 - iy1);
  const interArea = interW * interH;
  if (interArea === 0) return 0;
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return interArea / (areaA + areaB - interArea);
}

// Greedy NMS, applied per class so that adjacent tiles of different classes
// (which sit close together in a packed hand row) never suppress each other.
export function nms(boxes: ScoredBox[], iouThreshold: number): ScoredBox[] {
  const byClass = new Map<number, ScoredBox[]>();
  for (const box of boxes) {
    const group = byClass.get(box.classIndex);
    if (group) group.push(box);
    else byClass.set(box.classIndex, [box]);
  }

  const kept: ScoredBox[] = [];
  for (const group of byClass.values()) {
    const sorted = [...group].sort((a, b) => b.score - a.score);
    const suppressed = new Array(sorted.length).fill(false);
    for (let i = 0; i < sorted.length; i++) {
      if (suppressed[i]) continue;
      kept.push(sorted[i]);
      for (let j = i + 1; j < sorted.length; j++) {
        if (suppressed[j]) continue;
        if (iou(sorted[i], sorted[j]) > iouThreshold) suppressed[j] = true;
      }
    }
  }
  return kept;
}
