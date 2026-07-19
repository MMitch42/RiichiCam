import { describe, it, expect } from 'vitest';
import { CLASS_NAMES, classIndexToLabel } from '../tile-classes';

// Confirmed directly against the trained checkpoint's model.names (this is
// Roboflow's default alphabetical data.yaml ordering, NOT the private
// training pipeline's suit-grouped order) — any drift here silently
// mislabels every detection, so it's pinned as a literal, not derived.
const EXPECTED = [
  '1m', '1p', '1s', '1z',
  '2m', '2p', '2s', '2z',
  '3m', '3p', '3s', '3z',
  '4m', '4p', '4s', '4z',
  '5m', '5mr', '5p', '5pr', '5s', '5sr', '5z',
  '6m', '6p', '6s', '6z',
  '7m', '7p', '7s', '7z',
  '8m', '8p', '8s',
  '9m', '9p', '9s',
];

describe('CLASS_NAMES', () => {
  it('matches the trained model class order exactly', () => {
    expect(CLASS_NAMES).toEqual(EXPECTED);
  });

  it('has 37 classes', () => {
    expect(CLASS_NAMES).toHaveLength(37);
  });
});

describe('classIndexToLabel', () => {
  it('resolves valid indices', () => {
    expect(classIndexToLabel(0)).toBe('1m');
    expect(classIndexToLabel(36)).toBe('9s');
  });

  it('throws on out-of-range indices', () => {
    expect(() => classIndexToLabel(-1)).toThrow(/out of range/);
    expect(() => classIndexToLabel(37)).toThrow(/out of range/);
  });
});
