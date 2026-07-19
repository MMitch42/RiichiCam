import { describe, it, expect } from 'vitest';
import { nms, type ScoredBox } from '../nms';

describe('nms', () => {
  it('suppresses a lower-scoring box that heavily overlaps a same-class box', () => {
    const boxes: ScoredBox[] = [
      { x: 100, y: 100, width: 40, height: 60, score: 0.9, classIndex: 0 },
      { x: 105, y: 102, width: 40, height: 60, score: 0.6, classIndex: 0 }, // near-duplicate
    ];
    const kept = nms(boxes, 0.5);
    expect(kept).toHaveLength(1);
    expect(kept[0].score).toBe(0.9);
  });

  it('keeps overlapping boxes of different classes (adjacent tiles in a hand)', () => {
    const boxes: ScoredBox[] = [
      { x: 100, y: 100, width: 40, height: 60, score: 0.9, classIndex: 0 }, // e.g. "1m"
      { x: 130, y: 100, width: 40, height: 60, score: 0.85, classIndex: 1 }, // e.g. "2m", overlapping edge
    ];
    const kept = nms(boxes, 0.3);
    expect(kept).toHaveLength(2);
  });

  it('keeps non-overlapping boxes of the same class', () => {
    const boxes: ScoredBox[] = [
      { x: 50, y: 50, width: 20, height: 20, score: 0.8, classIndex: 3 },
      { x: 500, y: 500, width: 20, height: 20, score: 0.7, classIndex: 3 },
    ];
    const kept = nms(boxes, 0.5);
    expect(kept).toHaveLength(2);
  });

  it('returns an empty array for no input', () => {
    expect(nms([], 0.5)).toEqual([]);
  });
});
