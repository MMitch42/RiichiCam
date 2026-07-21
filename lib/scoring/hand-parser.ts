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

// Determine every valid wait type for a given (pair, groups) grouping.
//
// A single grouping can be genuinely ambiguous about which wait completed it:
// e.g. pair+4m5m5m6m6m7m winning on 6m groups as {4m5m6m}+{5m6m7m} either way,
// but the winning 6m could be "the one that completed 4m5m_" (ryanmen) or
// "the one that completed 5m_7m" (kanchan) - both are valid readings of the
// same three-group shape, since the two 6m tiles are otherwise identical.
// Every group whose tiles contain the winning tile's value is a legitimate
// candidate, so all of them are returned and the caller scores each as a
// separate interpretation rather than us guessing which one "wins" here.
function determineWaits(
  pair: Tile,
  groups: TileGroup[],
  winningTile: Tile,
): WaitType[] {
  const waits = new Set<WaitType>();

  // Tanki: winning tile completes the pair. This is only ONE possible
  // narrative when the winning tile's value also appears in a group (e.g.
  // three copies of a tile: two held as a pair-in-progress plus one that
  // also happens to complete a sequence) - it must not short-circuit the
  // group checks below, or a legitimate ryanmen/pinfu reading gets silently
  // dropped in favor of a worse-scoring tanki-only interpretation.
  if (tilesEqual(winningTile, pair)) {
    waits.add("tanki");
  }

  for (const group of groups) {
    const hasWinner = group.tiles.some((t) => tilesEqual(t, winningTile));
    if (!hasWinner) continue;

    if (group.type === "triplet") {
      // Shanpon: completing a shanpon wait (the pair is actually the other shanpon tile)
      // In shanpon, winningTile forms a triplet and pair tile is the "other" candidate
      waits.add("shanpon");
      continue;
    }

    if (group.type === "sequence" && isSuited(winningTile)) {
      const wv = (winningTile as SuitedTile).value;
      const vals = group.tiles
        .filter(isSuited)
        .map((t) => (t as SuitedTile).value)
        .sort((a, b) => a - b) as number[];
      const [low, mid, high] = vals;

      if (wv === mid) waits.add("kanchan"); // middle tile → closed wait
      // Penchan (edge wait): the winning tile is the only side that could
      // complete the partial run - held 1-2 won on 3, or held 8-9 won on 7.
      else if (wv === high && high === 3) waits.add("penchan"); // held 1-2, waited 3
      else if (wv === low && low === 7) waits.add("penchan"); // held 8-9, waited 7
      // Any other end completion is a two-sided ryanmen wait.
      else waits.add("ryanmen");
    }
  }

  if (waits.size === 0) return ["ryanmen"]; // fallback, shouldn't happen for a valid grouping
  return Array.from(waits);
}

// Special: shanpon - winning tile is a triplet but pair came from the other candidate
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
      const groupsKey =
        tileKey(pairTile) +
        "|" +
        groups
          .map((g) => g.type + g.tiles.map(tileKey).join(","))
          .sort()
          .join("|");

      // A single (pair, groups) shape can have more than one valid wait-type
      // reading (see determineWaits) - each is scored as its own interpretation,
      // so the dedup key must include the wait type, not just the shape.
      for (const wait of determineWaits(pairTile, groups, winningTile)) {
        const key = groupsKey + "|" + wait;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({ pair: pairTile, groups, waitType: wait, winningTile });
      }
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
  // 13-sided wait vs tanki depends on the PRE-WIN 13-tile hand, not the final
  // 14-tile one - every valid kokushi win has all 13 types present once the
  // winning tile is added, so checking the post-win hand can never tell the
  // two apart. If the pre-win hand already holds all 13 types (no duplicate
  // yet), the winning tile could have been any of them: the 13-sided wait.
  // If the pre-win hand is missing exactly one type (and holds a duplicate of
  // some other type as the placeholder pair), only that missing type
  // completes it: an ordinary tanki wait.
  const preWin = [...all14];
  preWin.splice(preWin.findIndex((t) => tilesEqual(t, winningTile)), 1);
  const preWinTypes = new Set(preWin.map(tileKey));
  const isThirteenSided = KOKUSHI_TILES.every((orphan) => preWinTypes.has(tileKey(orphan)));
  return {
    type: "kokushi",
    waitType: isThirteenSided ? "kokushi-thirteen" : "tanki",
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
  // winningTile - we don't have it here, will be set by caller
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
