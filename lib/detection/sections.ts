import { roboflowLabelToTile, MIN_CONFIDENCE, type RawPrediction } from '../scoring/roboflow-parser';
import type { Tile } from '../scoring/types';

export type SectionBox = { x: number; y: number; w: number; h: number };

export interface SplitResult {
  hand: Tile[];
  winningTile: Tile | null;
  dora: Tile[];
}

// Client-side port of app/api/detect/route.ts's splitBySection, so guided-mode
// detection can run on-device without a server round-trip. Must stay in sync
// with that copy's behavior (padding, sort order, slice limits) — the two
// exist separately rather than sharing an import because the route handles
// the Roboflow-response shape server-side while this runs against whatever
// image dimensions the caller measured client-side; logic must still match.
export function splitBySection(
  predictions: RawPrediction[],
  sections: Partial<Record<'hand' | 'winning' | 'dora', SectionBox>>,
  imgWidth: number,
  imgHeight: number,
): SplitResult {
  const result: SplitResult = { hand: [], winningTile: null, dora: [] };

  const qualified = predictions.filter((p) => p.confidence >= MIN_CONFIDENCE);

  // Expand each section box by 2% on every side so tiles whose centres land
  // just outside the drawn overlay boundary aren't silently dropped.
  const PAD = 0.02;

  for (const [key, box] of Object.entries(sections) as [string, SectionBox][]) {
    const x1 = Math.max(0, (box.x - PAD) * imgWidth);
    const y1 = Math.max(0, (box.y - PAD) * imgHeight);
    const x2 = Math.min(imgWidth, (box.x + box.w + PAD) * imgWidth);
    const y2 = Math.min(imgHeight, (box.y + box.h + PAD) * imgHeight);

    const inBox = qualified
      .filter((p) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2)
      .sort((a, b) => a.x - b.x);

    const tiles: Tile[] = [];
    for (const p of inBox) {
      try { tiles.push(roboflowLabelToTile(p.class)); } catch { /* skip unknown labels */ }
    }

    if (key === 'hand') result.hand = tiles.slice(0, 13);
    if (key === 'winning') result.winningTile = tiles[0] ?? null;
    if (key === 'dora') result.dora = tiles.slice(0, 8);
  }

  return result;
}
