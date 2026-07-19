// Fixed class-index order the ONNX model's output channels correspond to.
// Mirrors `synthetic/tiles.py::CLASS_NAMES` in the (now private) training
// pipeline repo — that ordering is baked into the exported model's weights,
// so it must stay in this exact order regardless of what's convenient here.
export const CLASS_NAMES = [
  '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
  '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
  '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
  '1z', '2z', '3z', '4z', '5z', '6z', '7z',
  '5mr', '5pr', '5sr',
] as const;

export type TileClassName = (typeof CLASS_NAMES)[number];

export function classIndexToLabel(index: number): TileClassName {
  const label = CLASS_NAMES[index];
  if (label === undefined) {
    throw new Error(`Class index ${index} out of range (0..${CLASS_NAMES.length - 1})`);
  }
  return label;
}
