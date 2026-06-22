import type { Tile, SuitedTile } from "./types";
import { isSuited, isHonor, tilesEqual, sortTiles } from "./tiles";

export type WaitType = "ryanmen" | "shanpon" | "kanchan" | "penchan" | "tanki";

export type GroupType = "sequence" | "triplet" | "pair";

export interface TileGroup {
  type: GroupType;
  tiles: Tile[];
}

export interface HandInterpretation {
  pair: Tile;
  groups: TileGroup[]; // 4 mentsu (sequence or triplet)
  waitType: WaitType;
  winningTile: Tile;
}

// Remove one instance of a tile from an array (by value equality, ignores aka)
function removeTile(tiles: Tile[], target: Tile): Tile[] | null {
  const idx = tiles.findIndex((t) => tilesEqual(t, target));
  if (idx === -1) return null;
  const result = [...tiles];
  result.splice(idx, 1);
  return result;
}

function canFormSequence(tiles: Tile[], start: SuitedTile): boolean {
  if (start.value > 7) return false;
  const mid: SuitedTile = { suit: start.suit, value: (start.value + 1) as SuitedTile["value"] };
  const end: SuitedTile = { suit: start.suit, value: (start.value + 2) as SuitedTile["value"] };
  let remaining = removeTile(tiles, start);
  if (!remaining) return false;
  remaining = removeTile(remaining, mid);
  if (!remaining) return false;
  remaining = removeTile(remaining, end);
  return remaining !== null;
}

function removeSequence(tiles: Tile[], start: SuitedTile): Tile[] | null {
  if (start.value > 7) return null;
  const mid: SuitedTile = { suit: start.suit, value: (start.value + 1) as SuitedTile["value"] };
  const end: SuitedTile = { suit: start.suit, value: (start.value + 2) as SuitedTile["value"] };
  let r = removeTile(tiles, start);
  if (!r) return null;
  r = removeTile(r, mid);
  if (!r) return null;
  return removeTile(r, end);
}

function removeTriplet(tiles: Tile[], t: Tile): Tile[] | null {
  let r = removeTile(tiles, t);
  if (!r) return null;
  r = removeTile(r, t);
  if (!r) return null;
  return removeTile(r, t);
}

// Recursively find all valid mentsu groupings for the remaining tiles
function findGroupings(tiles: Tile[]): TileGroup[][] {
  if (tiles.length === 0) return [[]];
  if (tiles.length % 3 !== 0) return [];

  const results: TileGroup[][] = [];
  const sorted = sortTiles(tiles);
  const first = sorted[0];

  // Try triplet
  const afterTriplet = removeTriplet(sorted, first);
  if (afterTriplet) {
    for (const rest of findGroupings(afterTriplet)) {
      results.push([{ type: "triplet", tiles: [first, first, first] }, ...rest]);
    }
  }

  // Try sequence (only for suited tiles)
  if (isSuited(first) && first.value <= 7) {
    const afterSeq = removeSequence(sorted, first as SuitedTile);
    if (afterSeq) {
      const mid = { suit: first.suit, value: (first.value + 1) as SuitedTile["value"] } as SuitedTile;
      const end = { suit: first.suit, value: (first.value + 2) as SuitedTile["value"] } as SuitedTile;
      for (const rest of findGroupings(afterSeq)) {
        results.push([{ type: "sequence", tiles: [first, mid, end] }, ...rest]);
      }
    }
  }

  return results;
}

// Determine wait type for a given interpretation
function determineWait(
  pair: Tile,
  groups: TileGroup[],
  winningTile: Tile,
): WaitType {
  // Tanki: winning tile completes the pair
  if (tilesEqual(winningTile, pair)) {
    // Check if winning tile appears only as pair (not in any mentsu)
    // We assume here the interpretation is valid
    return "tanki";
  }

  // Find the group containing the winning tile
  for (const group of groups) {
    const hasWinner = group.tiles.some((t) => tilesEqual(t, winningTile));
    if (!hasWinner) continue;

    if (group.type === "triplet") {
      // Shanpon: completing a shanpon wait (the pair is actually the other shanpon tile)
      // In shanpon, winningTile forms a triplet and pair tile is the "other" candidate
      return "shanpon";
    }

    if (group.type === "sequence" && isSuited(winningTile)) {
      const wv = (winningTile as SuitedTile).value;
      const vals = group.tiles
        .filter(isSuited)
        .map((t) => (t as SuitedTile).value)
        .sort((a, b) => a - b) as number[];
      const [low, , high] = vals;

      if (wv === vals[1]) return "kanchan"; // middle tile
      if (wv === low) {
        // penchan if low === 1, else ryanmen
        return low === 1 ? "penchan" : "ryanmen";
      }
      if (wv === high) {
        return high === 9 ? "penchan" : "ryanmen";
      }
    }
  }

  return "ryanmen"; // fallback
}

// Special: shanpon — winning tile is a triplet but pair came from the other candidate
// We need to re-examine: in shanpon the winning tile could be in the "pair" slot
function buildInterpretations(
  allTiles: Tile[],
  winningTile: Tile,
): HandInterpretation[] {
  const sorted = sortTiles(allTiles);
  const seen = new Set<string>();
  const results: HandInterpretation[] = [];

  // Try each unique tile as the pair
  for (let i = 0; i < sorted.length; i++) {
    const pairTile = sorted[i];
    if (i > 0 && tilesEqual(sorted[i - 1], pairTile)) continue; // deduplicate

    const afterPair = removeTile(sorted, pairTile);
    if (!afterPair) continue;
    const afterPair2 = removeTile(afterPair, pairTile);
    if (!afterPair2) continue;

    const groupings = findGroupings(afterPair2);
    for (const groups of groupings) {
      const key =
        tileKey(pairTile) +
        "|" +
        groups
          .map((g) => g.type + g.tiles.map(tileKey).join(","))
          .sort()
          .join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const wait = determineWait(pairTile, groups, winningTile);
      results.push({ pair: pairTile, groups, waitType: wait, winningTile });
    }
  }

  return results;
}

function tileKey(t: Tile): string {
  return `${t.suit}:${t.value}`;
}

export interface ChiitoitsuInterpretation {
  type: "chiitoitsu";
  pairs: Tile[]; // 7 representative tiles (one from each pair)
  waitType: "tanki";
  winningTile: Tile;
  // Some seven-pairs shapes (e.g. 223344m223344p55s) are also valid standard
  // hands (ryanpeikou). Carried along so the caller can score both and keep
  // whichever is worth more, instead of always assuming chiitoitsu.
  standardAlt?: HandInterpretation[];
}

export interface KokushiInterpretation {
  type: "kokushi";
  waitType: "tanki" | "kokushi-thirteen";
  winningTile: Tile;
}

export type ParsedHand =
  | { type: "standard"; interpretations: HandInterpretation[] }
  | ChiitoitsuInterpretation
  | KokushiInterpretation
  | { type: "invalid"; reason: string };

const KOKUSHI_TILES: Tile[] = [
  { suit: "man", value: 1 },
  { suit: "man", value: 9 },
  { suit: "pin", value: 1 },
  { suit: "pin", value: 9 },
  { suit: "sou", value: 1 },
  { suit: "sou", value: 9 },
  { suit: "honor", value: "east" },
  { suit: "honor", value: "south" },
  { suit: "honor", value: "west" },
  { suit: "honor", value: "north" },
  { suit: "honor", value: "haku" },
  { suit: "honor", value: "hatsu" },
  { suit: "honor", value: "chun" },
];

function isKokushi(tiles: Tile[], winningTile: Tile): KokushiInterpretation | null {
  const all14 = tiles;
  for (const orphan of KOKUSHI_TILES) {
    if (!all14.some((t) => tilesEqual(t, orphan))) return null;
  }
  // Has all 13 — check for 13-sided wait
  const counts = new Map<string, number>();
  for (const t of all14) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
  const isThirteenSided = KOKUSHI_TILES.every((orphan) => (counts.get(tileKey(orphan)) ?? 0) >= 1);
  if (!isThirteenSided) return null;
  const allOrphans = KOKUSHI_TILES.some((o) => tilesEqual(o, winningTile));
  return {
    type: "kokushi",
    waitType: allOrphans ? "kokushi-thirteen" : "tanki",
    winningTile,
  };
}

function isChiitoitsu(tiles: Tile[]): ChiitoitsuInterpretation | null {
  if (tiles.length !== 14) return null;
  const counts = new Map<string, { tile: Tile; count: number }>();
  for (const t of tiles) {
    const k = tileKey(t);
    const entry = counts.get(k);
    if (entry) entry.count++;
    else counts.set(k, { tile: t, count: 1 });
  }
  const pairs = Array.from(counts.values()).filter((e) => e.count === 2);
  if (pairs.length !== 7) return null;
  // winningTile — we don't have it here, will be set by caller
  return null; // handled in parseHand
}

export function parseHand(
  closedTiles: Tile[],
  melds: { tiles: Tile[] }[],
  winningTile: Tile,
): ParsedHand {
  // All closed tiles including winning tile
  const allClosed = [...closedTiles, winningTile];

  // Chiitoitsu requires no open melds
  if (melds.length === 0 && allClosed.length === 14) {
    const counts = new Map<string, { tile: Tile; count: number }>();
    for (const t of allClosed) {
      const k = tileKey(t);
      const entry = counts.get(k);
      if (entry) entry.count++;
      else counts.set(k, { tile: t, count: 1 });
    }
    const pairs = Array.from(counts.values()).filter((e) => e.count === 2);
    if (pairs.length === 7) {
      const standardAlt = buildInterpretations(allClosed, winningTile);
      return {
        type: "chiitoitsu",
        pairs: pairs.map((p) => p.tile),
        waitType: "tanki",
        winningTile,
        standardAlt: standardAlt.length > 0 ? standardAlt : undefined,
      };
    }
  }

  // Kokushi requires no open melds
  if (melds.length === 0 && allClosed.length === 14) {
    const kokushi = isKokushi(allClosed, winningTile);
    if (kokushi) return kokushi;
  }

  // Standard: need exactly 14 - 3*melds.length closed tiles
  const expected = 14 - 3 * melds.length;
  if (allClosed.length !== expected) {
    return { type: "invalid", reason: `Expected ${expected} closed tiles, got ${allClosed.length}` };
  }

  const interpretations = buildInterpretations(allClosed, winningTile);
  if (interpretations.length === 0) {
    return { type: "invalid", reason: "No valid winning hand grouping found" };
  }

  return { type: "standard", interpretations };
}
