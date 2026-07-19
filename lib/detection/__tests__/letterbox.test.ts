import { describe, it, expect } from 'vitest';
import { computeLetterbox, unletterboxBox } from '../letterbox';

describe('computeLetterbox', () => {
  it('scales a landscape image down to fit, padding top/bottom', () => {
    const info = computeLetterbox(1600, 1200, 640);
    expect(info.scale).toBeCloseTo(640 / 1600, 6);
    // new height = 1200 * 0.4 = 480; pad = (640-480)/2 = 80 on each side
    expect(info.padY).toBeCloseTo(80, 6);
    expect(info.padX).toBeCloseTo(0, 6);
  });

  it('scales a portrait image down to fit, padding left/right', () => {
    const info = computeLetterbox(900, 1600, 640);
    expect(info.scale).toBeCloseTo(640 / 1600, 6);
    const newWidth = 900 * info.scale;
    expect(info.padX).toBeCloseTo((640 - newWidth) / 2, 6);
    expect(info.padY).toBeCloseTo(0, 6);
  });

  it('handles a square image with no padding', () => {
    const info = computeLetterbox(640, 640, 640);
    expect(info.scale).toBeCloseTo(1, 6);
    expect(info.padX).toBeCloseTo(0, 6);
    expect(info.padY).toBeCloseTo(0, 6);
  });
});

describe('unletterboxBox', () => {
  it('inverts scale and padding to recover original-space coordinates', () => {
    const info = computeLetterbox(1600, 1200, 640);
    // A box sitting exactly at the model-space center.
    const modelBox = { x: 320, y: 320, width: 64, height: 48 };
    const orig = unletterboxBox(modelBox, info);
    expect(orig.x).toBeCloseTo(800, 3); // 1600/2
    expect(orig.y).toBeCloseTo(600, 3); // 1200/2
    expect(orig.width).toBeCloseTo(64 / info.scale, 6);
    expect(orig.height).toBeCloseTo(48 / info.scale, 6);
  });

  it('round-trips through the padding offset correctly', () => {
    const info = computeLetterbox(900, 1600, 640);
    // Top-left corner of the drawn (unpadded) content in model space.
    const modelBox = { x: info.padX, y: info.padY, width: 10, height: 10 };
    const orig = unletterboxBox(modelBox, info);
    expect(orig.x).toBeCloseTo(0, 3);
    expect(orig.y).toBeCloseTo(0, 3);
  });
});
