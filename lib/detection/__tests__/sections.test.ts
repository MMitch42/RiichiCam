import { describe, it, expect } from 'vitest';
import { splitBySection } from '../sections';
import type { RawPrediction } from '../../scoring/roboflow-parser';

function pred(x: number, y: number, cls: string, confidence = 0.9): RawPrediction {
  return { class: cls, confidence, x, y, width: 40, height: 60 };
}

describe('splitBySection', () => {
  it('buckets predictions into hand/winning/dora by position', () => {
    const predictions = [
      pred(100, 100, '1m'), // hand
      pred(100, 120, '2m'), // hand
      pred(700, 100, '9p'), // winning
      pred(100, 700, '5z'), // dora
    ];
    const result = splitBySection(
      predictions,
      {
        hand: { x: 0, y: 0.1, w: 0.5, h: 0.3 },
        winning: { x: 0.5, y: 0.1, w: 0.5, h: 0.3 },
        dora: { x: 0, y: 0.6, w: 1, h: 0.3 },
      },
      1000,
      1000,
    );
    expect(result.hand.length).toBe(2);
    expect(result.winningTile).not.toBeNull();
    expect(result.dora.length).toBe(1);
  });

  it('sorts hand tiles left-to-right by x position', () => {
    const predictions = [
      pred(300, 100, '3m'),
      pred(100, 100, '1m'),
      pred(200, 100, '2m'),
    ];
    const result = splitBySection(predictions, { hand: { x: 0, y: 0, w: 1, h: 1 } }, 1000, 1000);
    expect(result.hand).toEqual([
      { suit: 'man', value: 1 },
      { suit: 'man', value: 2 },
      { suit: 'man', value: 3 },
    ]);
  });

  it('filters out predictions below the confidence threshold', () => {
    const predictions = [pred(100, 100, '1m', 0.1)];
    const result = splitBySection(predictions, { hand: { x: 0, y: 0, w: 1, h: 1 } }, 1000, 1000);
    expect(result.hand).toEqual([]);
  });

  it('includes predictions just outside the box within the 2% padding', () => {
    // Box is x:[0.1,0.5] in a 1000-wide image -> [100,500]px. A tile at x=95
    // (5px outside) should still qualify since 2% of 1000 = 20px padding.
    const predictions = [pred(95, 100, '1m')];
    const result = splitBySection(predictions, { hand: { x: 0.1, y: 0, w: 0.4, h: 1 } }, 1000, 1000);
    expect(result.hand.length).toBe(1);
  });

  it('excludes predictions well outside the padded box', () => {
    const predictions = [pred(50, 100, '1m')];
    const result = splitBySection(predictions, { hand: { x: 0.1, y: 0, w: 0.4, h: 1 } }, 1000, 1000);
    expect(result.hand).toEqual([]);
  });

  it('caps hand at 13 tiles and dora at 8', () => {
    const manyHand = Array.from({ length: 20 }, (_, i) => pred(i * 10, 100, '1m'));
    const manyDora = Array.from({ length: 10 }, (_, i) => pred(i * 10, 500, '2m'));
    const result = splitBySection(
      [...manyHand, ...manyDora],
      { hand: { x: 0, y: 0, w: 1, h: 0.3 }, dora: { x: 0, y: 0.4, w: 1, h: 0.3 } },
      1000,
      1000,
    );
    expect(result.hand.length).toBe(13);
    expect(result.dora.length).toBe(8);
  });

  it('skips unrecognized labels rather than throwing', () => {
    const predictions = [pred(100, 100, 'bogus-label'), pred(150, 100, '1m')];
    const result = splitBySection(predictions, { hand: { x: 0, y: 0, w: 1, h: 1 } }, 1000, 1000);
    expect(result.hand).toEqual([{ suit: 'man', value: 1 }]);
  });

  it('returns null winningTile and empty arrays when no sections given', () => {
    const result = splitBySection([pred(100, 100, '1m')], {}, 1000, 1000);
    expect(result).toEqual({ hand: [], winningTile: null, dora: [] });
  });
});
