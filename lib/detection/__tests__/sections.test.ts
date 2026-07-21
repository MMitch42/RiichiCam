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

  it('hand and dora have a generous safety-valve ceiling, not a fake structural cap', () => {
    // These ceilings (18 hand, 12 dora) exist only to bound a malfunctioning
    // detector's noise, not to enforce the real 13-tile hand shape - that's
    // validated downstream once melds are known. A real scan should never hit
    // them; pushing well past any realistic count proves they don't silently
    // truncate normal over-detection (e.g. a few extra called-meld tiles
    // sitting in the same frame as the concealed hand).
    const manyHand = Array.from({ length: 30 }, (_, i) => pred(i * 10, 100, '1m'));
    const manyDora = Array.from({ length: 20 }, (_, i) => pred(i * 10, 500, '2m'));
    const result = splitBySection(
      [...manyHand, ...manyDora],
      { hand: { x: 0, y: 0, w: 1, h: 0.3 }, dora: { x: 0, y: 0.4, w: 1, h: 0.3 } },
      1000,
      1000,
    );
    expect(result.hand.length).toBe(18);
    expect(result.dora.length).toBe(12);
  });

  it('skips unrecognized labels rather than throwing', () => {
    const predictions = [pred(100, 100, 'bogus-label'), pred(150, 100, '1m')];
    const result = splitBySection(predictions, { hand: { x: 0, y: 0, w: 1, h: 1 } }, 1000, 1000);
    expect(result.hand).toEqual([{ suit: 'man', value: 1 }]);
  });

  it('returns null winningTile and empty arrays when no sections given', () => {
    const result = splitBySection([pred(100, 100, '1m')], {}, 1000, 1000);
    expect(result).toEqual({ hand: [], winningTile: null, dora: [], melds: [] });
  });

  it('groups a meld-region pon into melds and keeps it out of hand', () => {
    const predictions = [
      pred(100, 100, '1m'), // hand: single concealed tile
      pred(700, 100, '5z'), pred(720, 100, '5z'), pred(740, 100, '5z'), // meld: pon of haku
    ];
    const result = splitBySection(
      predictions,
      { hand: { x: 0, y: 0, w: 0.5, h: 1 }, meld: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      1000,
      1000,
    );
    expect(result.hand).toEqual([{ suit: 'man', value: 1 }]);
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0].type).toBe('pon');
  });

  it('merges ungroupable meld-region tiles back into hand instead of dropping them', () => {
    const predictions = [
      pred(700, 100, '5z'), pred(720, 100, '6z'), // meld region: two different honors, not a valid call
    ];
    const result = splitBySection(
      predictions,
      { hand: { x: 0, y: 0, w: 0.5, h: 1 }, meld: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      1000,
      1000,
    );
    expect(result.melds).toEqual([]);
    expect(result.hand).toHaveLength(2);
  });
});
