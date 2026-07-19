// Fixed class-index order the ONNX model's output channels correspond to.
// This is NOT the (now private) training pipeline's synthetic/tiles.py
// order (grouped by suit, aka last) — this specific model was trained from
// a Roboflow-exported dataset, and Roboflow's default data.yaml generation
// sorts class names alphabetically as plain strings. Confirmed directly
// against the trained checkpoint's `model.names` (ultralytics YOLO), not
// assumed — a wrong guess here would silently mislabel every detection
// since both orderings have exactly 37 classes, so a count check alone
// can't catch it.
export const CLASS_NAMES = [
  '1m', '1p', '1s', '1z',
  '2m', '2p', '2s', '2z',
  '3m', '3p', '3s', '3z',
  '4m', '4p', '4s', '4z',
  '5m', '5mr', '5p', '5pr', '5s', '5sr', '5z',
  '6m', '6p', '6s', '6z',
  '7m', '7p', '7s', '7z',
  '8m', '8p', '8s',
  '9m', '9p', '9s',
] as const;

export type TileClassName = (typeof CLASS_NAMES)[number];

export function classIndexToLabel(index: number): TileClassName {
  const label = CLASS_NAMES[index];
  if (label === undefined) {
    throw new Error(`Class index ${index} out of range (0..${CLASS_NAMES.length - 1})`);
  }
  return label;
}
