import { describe, it, expect } from 'vitest';
import { decodeYoloOutput } from '../decode-yolo-output';
import { computeLetterbox } from '../letterbox';
import { CLASS_NAMES } from '../tile-classes';

const NUM_CLASSES = CLASS_NAMES.length;

interface AnchorSpec {
  box: { x: number; y: number; width: number; height: number };
  classIndex: number;
  score: number;
}

// Builds a flattened [4+numClasses, numAnchors] tensor (channel-major, the
// layout onnxruntime-web returns for a squeezed batch=1 YOLO output) from a
// sparse list of anchors; unspecified channels default to 0.
function buildTensor(numAnchors: number, anchors: Partial<Record<number, AnchorSpec>>): Float32Array {
  const channels = 4 + NUM_CLASSES;
  const data = new Float32Array(channels * numAnchors);
  for (const [idxStr, spec] of Object.entries(anchors)) {
    const a = Number(idxStr);
    data[0 * numAnchors + a] = spec!.box.x;
    data[1 * numAnchors + a] = spec!.box.y;
    data[2 * numAnchors + a] = spec!.box.width;
    data[3 * numAnchors + a] = spec!.box.height;
    data[(4 + spec!.classIndex) * numAnchors + a] = spec!.score;
  }
  return data;
}

describe('decodeYoloOutput', () => {
  it('decodes a confident detection into a RawPrediction with the right label', () => {
    const numAnchors = 3;
    const data = buildTensor(numAnchors, {
      0: { box: { x: 320, y: 320, width: 40, height: 60 }, classIndex: 0, score: 0.9 },
    });
    const letterbox = computeLetterbox(640, 640, 640); // identity: scale 1, no padding
    const preds = decodeYoloOutput({ data, numAnchors, numClasses: NUM_CLASSES }, letterbox);

    expect(preds).toHaveLength(1);
    expect(preds[0].class).toBe('1m');
    expect(preds[0].confidence).toBeCloseTo(0.9, 6);
    expect(preds[0].x).toBeCloseTo(320, 6);
    expect(preds[0].y).toBeCloseTo(320, 6);
  });

  it('filters out anchors below the confidence threshold', () => {
    const numAnchors = 2;
    const data = buildTensor(numAnchors, {
      0: { box: { x: 100, y: 100, width: 20, height: 20 }, classIndex: 5, score: 0.1 },
    });
    const letterbox = computeLetterbox(640, 640, 640);
    const preds = decodeYoloOutput({ data, numAnchors, numClasses: NUM_CLASSES }, letterbox);
    expect(preds).toHaveLength(0);
  });

  it('suppresses a near-duplicate lower-confidence box via NMS', () => {
    const numAnchors = 2;
    const data = buildTensor(numAnchors, {
      0: { box: { x: 320, y: 320, width: 40, height: 60 }, classIndex: 0, score: 0.9 },
      1: { box: { x: 322, y: 321, width: 40, height: 60 }, classIndex: 0, score: 0.95 },
    });
    const letterbox = computeLetterbox(640, 640, 640);
    const preds = decodeYoloOutput({ data, numAnchors, numClasses: NUM_CLASSES }, letterbox);
    expect(preds).toHaveLength(1);
    expect(preds[0].confidence).toBeCloseTo(0.95, 6);
  });

  it('maps model-space coordinates back to original image pixels through letterbox padding', () => {
    const numAnchors = 1;
    // 1600x1200 source -> letterboxed into 640x640 with vertical padding.
    const letterbox = computeLetterbox(1600, 1200, 640);
    const data = buildTensor(numAnchors, {
      0: {
        box: { x: 320, y: letterbox.padY + 10, width: 20, height: 20 },
        classIndex: 3,
        score: 0.8,
      },
    });
    const preds = decodeYoloOutput({ data, numAnchors, numClasses: NUM_CLASSES }, letterbox);
    expect(preds).toHaveLength(1);
    expect(preds[0].x).toBeCloseTo(800, 3); // 320 / scale == center of 1600-wide source
    expect(preds[0].y).toBeCloseTo(10 / letterbox.scale, 3);
  });

  it('throws if the model output class count does not match tile-classes.ts', () => {
    const numAnchors = 1;
    const data = new Float32Array((4 + 10) * numAnchors);
    const letterbox = computeLetterbox(640, 640, 640);
    expect(() => decodeYoloOutput({ data, numAnchors, numClasses: 10 }, letterbox)).toThrow(
      /class/i,
    );
  });
});
