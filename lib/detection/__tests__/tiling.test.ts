import { describe, expect, it } from 'vitest';
import { coverageWindows, inferenceTiles, normalizedRegionBounds } from '../tiling';

describe('inference tiling', () => {
  it('covers every pixel of an extreme-aspect ROI with overlapping slices', () => {
    expect(inferenceTiles(600, 100)).toEqual([
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 160, y: 0, width: 200, height: 100 },
      { x: 320, y: 0, width: 200, height: 100 },
      { x: 400, y: 0, width: 200, height: 100 },
    ]);
  });

  it('turns a visible normalized box into a full-coverage source crop', () => {
    expect(normalizedRegionBounds({ x: 0.1, y: 0.2, w: 0.6, h: 0.3 }, 1001, 799)).toEqual({
      x: 100,
      y: 159,
      width: 601,
      height: 241,
    });
  });

  it('covers a normal camera photo without guessing where the hand is', () => {
    const windows = coverageWindows(1000, 600);
    expect(windows).toHaveLength(4);
    expect(windows).toEqual(expect.arrayContaining([
      { x: 0, y: 0, width: 600, height: 360 },
      { x: 400, y: 240, width: 600, height: 360 },
    ]));
    expect(Math.min(...windows.map((window) => window.x))).toBe(0);
    expect(Math.max(...windows.map((window) => window.x + window.width))).toBe(1000);
    expect(Math.min(...windows.map((window) => window.y))).toBe(0);
    expect(Math.max(...windows.map((window) => window.y + window.height))).toBe(600);
  });
});
