import { roboflowLabelToTile, MIN_CONFIDENCE, type RawPrediction } from '../scoring/roboflow-parser';
import type { Tile, Meld } from '../scoring/types';
import { groupTilesIntoMelds } from '../scoring/meld-grouping';

export type SectionBox = { x: number; y: number; w: number; h: number };

export interface SplitResult {
  hand: Tile[];
  winningTile: Tile | null;
  dora: Tile[];
  melds: Meld[];
}

// Soft ceilings on how many tiles a single region can contribute. These are
// safety valves against a malfunctioning detector returning a flood of noise
// boxes, NOT real structural limits - a real hand's concealed portion caps at
// 13 (fewer with melds), dora indicators realistically cap around 5 (1 +
// one per kan), and called melds cap around 16 (4 melds x 4 tiles for a kan),
// but none of those real limits should ever be enforced here by silently
// dropping tiles a user actually scanned. The old `.slice(0, 13)` /
// `.slice(0, 8)` truncation did exactly that: any extra detection - most
// commonly called-meld tiles sitting in the same frame as the concealed hand,
// or overlap with the winning-tile box - vanished with no indication to the
// user, who'd then have no way to know 2 of their 15 scanned tiles were
// discarded. The real structural count is enforced downstream, where the
// hand/melds actually get validated for scoring; this layer's job is just to
// not lose what the model found.
const MAX_HAND_TILES = 18;
const MAX_MELD_TILES = 20;
const MAX_DORA_TILES = 12;

// Client-side port of the on-device detection pipeline's per-section splitter.
// Runs entirely in the browser, no server round-trip.
export function splitBySection(
  predictions: RawPrediction[],
  sections: Partial<Record<'hand' | 'winning' | 'dora' | 'meld', SectionBox>>,
  imgWidth: number,
  imgHeight: number,
): SplitResult {
  const result: SplitResult = { hand: [], winningTile: null, dora: [], melds: [] };
  // Tiles placed in the melds region that couldn't be resolved into a
  // complete call fall back into the concealed hand rather than being
  // dropped (see groupTilesIntoMelds) - merged after the loop so hand/meld
  // box order in `sections` doesn't matter.
  let meldLeftovers: Tile[] = [];

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

    if (key === 'hand') result.hand = tiles.slice(0, MAX_HAND_TILES);
    if (key === 'winning') result.winningTile = tiles[0] ?? null;
    if (key === 'dora') result.dora = tiles.slice(0, MAX_DORA_TILES);
    if (key === 'meld') {
      const { melds, ungrouped } = groupTilesIntoMelds(tiles.slice(0, MAX_MELD_TILES));
      result.melds = melds;
      meldLeftovers = ungrouped;
    }
  }

  if (meldLeftovers.length > 0) {
    result.hand = [...result.hand, ...meldLeftovers].slice(0, MAX_HAND_TILES);
  }

  return result;
}
