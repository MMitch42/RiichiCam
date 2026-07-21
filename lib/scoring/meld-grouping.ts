// Group a flat list of tiles (e.g. the "called melds" region of a guided scan)
// into concrete Meld structures. The detector returns only tile faces with no
// notion of which tiles form a call, so this reconstructs the meld boundaries
// from tile identities alone — the reliable signal (see the design discussion:
// the *placement* into the melds region is user-provided; only the meld *type*
// is inferred here, and only from identity + count, never from fragile geometry).
//
// Mapping, per riichi tile counts within the melds region:
//   run of 3 consecutive same-suit  -> chi        (open sequence)
//   3 identical                     -> pon        (open triplet)
//   4 identical                     -> kan-open   (all four faces up)
//   2 identical                     -> kan-closed (ankan: only the 2 inner
//                                                   faces are up; the outer 2
//                                                   are face-down, so the
//                                                   detector only ever sees 2)
//
// A closed kan's two face-down tiles can't be scanned, so 2-of-a-kind is the
// deliberate heuristic for it — the weakest rule, and the reason the manual
// MeldBuilder stays available to correct any mis-grouping.

import type { Tile, Meld } from "./types";
import { isSuited, tilesEqual, sortTiles } from "./tiles";

export interface MeldGroupingResult {
  melds: Meld[];
  /** Tiles that couldn't be placed into any valid meld — surfaced back to the
   *  concealed hand rather than dropped, so nothing a user scanned disappears. */
  ungrouped: Tile[];
}

/** Indices of up to `n` copies of `tiles[head]` (including `head` itself). */
function identicalRun(tiles: Tile[], n: number, head = 0): number[] | null {
  const out = [head];
  for (let i = 0; i < tiles.length && out.length < n; i++) {
    if (i !== head && tilesEqual(tiles[i], tiles[head])) out.push(i);
  }
  return out.length === n ? out : null;
}

/** Indices of a chi (tiles[head], +1, +2 in the same suit), each a distinct tile. */
function chiRun(tiles: Tile[], head = 0): number[] | null {
  const h = tiles[head];
  if (!isSuited(h) || h.value > 7) return null;
  const used = [head];
  for (const step of [1, 2]) {
    const idx = tiles.findIndex(
      (t, i) =>
        !used.includes(i) &&
        isSuited(t) &&
        t.suit === h.suit &&
        t.value === h.value + step,
    );
    if (idx === -1) return null;
    used.push(idx);
  }
  return used;
}

/** The meld anchored at head index `h`, in preference order, or null. */
function meldAt(tiles: Tile[], h: number): { indices: number[]; meld: Meld } | null {
  const kan = identicalRun(tiles, 4, h);
  if (kan) return { indices: kan, meld: { type: "kan-open", tiles: kan.map((i) => tiles[i]) as Meld["tiles"] } };
  const pon = identicalRun(tiles, 3, h);
  if (pon) return { indices: pon, meld: { type: "pon", tiles: pon.map((i) => tiles[i]) as Meld["tiles"] } };
  const chi = chiRun(tiles, h);
  if (chi) return { indices: chi, meld: { type: "chi", tiles: chi.map((i) => tiles[i]) as Meld["tiles"] } };
  const pair = identicalRun(tiles, 2, h);
  if (pair) return { indices: pair, meld: { type: "kan-closed", tiles: closedKanTiles(pair.map((i) => tiles[i])) as Meld["tiles"] } };
  return null;
}

function without(tiles: Tile[], indices: number[]): Tile[] {
  const drop = new Set(indices);
  return tiles.filter((_, i) => !drop.has(i));
}

/** A closed kan is stored with 4 tiles; only 2 faces were visible, so synthesize
 *  two plain (non-aka) copies for the face-down pair. */
function closedKanTiles(pair: Tile[]): Tile[] {
  const base: Tile = isSuited(pair[0])
    ? { suit: pair[0].suit, value: pair[0].value }
    : { suit: "honor", value: pair[0].value };
  return [pair[0], pair[1], base, { ...base }];
}

// Exhaustive backtracking partition into complete melds. Preference order
// (kan-open > pon > chi > kan-closed) resolves ambiguous multisets toward the
// interpretation with the most face-up tiles, falling back to the speculative
// 2-of-a-kind = closed-kan reading only when nothing else completes.
function partition(tiles: Tile[]): Meld[] | null {
  if (tiles.length === 0) return [];

  const attempts: Array<{ indices: number[]; meld: Meld }> = [];

  const kan = identicalRun(tiles, 4);
  if (kan) attempts.push({ indices: kan, meld: { type: "kan-open", tiles: kan.map((i) => tiles[i]) as Meld["tiles"] } });

  const pon = identicalRun(tiles, 3);
  if (pon) attempts.push({ indices: pon, meld: { type: "pon", tiles: pon.map((i) => tiles[i]) as Meld["tiles"] } });

  const chi = chiRun(tiles);
  if (chi) attempts.push({ indices: chi, meld: { type: "chi", tiles: chi.map((i) => tiles[i]) as Meld["tiles"] } });

  const pair = identicalRun(tiles, 2);
  if (pair) attempts.push({ indices: pair, meld: { type: "kan-closed", tiles: closedKanTiles(pair.map((i) => tiles[i])) as Meld["tiles"] } });

  for (const { indices, meld } of attempts) {
    const rest = partition(without(tiles, indices));
    if (rest) return [meld, ...rest];
  }
  return null;
}

/**
 * Partition `input` into complete melds. If every tile fits a meld, `ungrouped`
 * is empty. Otherwise the largest set of tiles that DOES partition cleanly is
 * returned as melds and the remainder as `ungrouped` (best-effort, so a missed
 * or extra detection degrades to "these tiles land back in the hand" rather
 * than losing the whole scan).
 */
export function groupTilesIntoMelds(input: Tile[]): MeldGroupingResult {
  const tiles = sortTiles(input);

  const full = partition(tiles);
  if (full) return { melds: full, ungrouped: [] };

  // Best-effort: peel complete melds greedily, trying every possible anchor so
  // one ungroupable tile at the front doesn't strand the rest; whatever can't
  // be placed is returned as ungrouped.
  const melds: Meld[] = [];
  let remaining = tiles;
  while (remaining.length > 0) {
    let found: { indices: number[]; meld: Meld } | null = null;
    for (let h = 0; h < remaining.length; h++) {
      found = meldAt(remaining, h);
      if (found) break;
    }
    if (!found) break;
    melds.push(found.meld);
    remaining = without(remaining, found.indices);
  }
  return { melds, ungrouped: remaining };
}
