// Differential-fuzzing corpus generator. Not a real assertion-based test: by
// default it's a no-op so `npm test` stays fast and deterministic. Run with
// GEN_FUZZ=1 to actually generate hands and score them with our engine; the
// output is compared against a reference implementation (MahjongRepository's
// `mahjong` PyPI package) by scripts/differential_check.py.
//
//   GEN_FUZZ=1 GEN_FUZZ_COUNT=5000 npx vitest run lib/scoring/__tests__/fuzz-corpus.test.ts
//   python3 scripts/differential_check.py
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { score } from "../index";
import type { Tile, Meld, Hand, WindValue, SuitedTile, MeldType } from "../types";
import { DEFAULT_RULES } from "../types";
import { tilesEqual } from "../tiles";

const OUT_PATH = process.env.GEN_FUZZ_OUT ?? "/tmp/riichicam-fuzz-corpus.jsonl";
const COUNT = Number(process.env.GEN_FUZZ_COUNT ?? 3000);
const SEED = Number(process.env.GEN_FUZZ_SEED ?? 42);

// Deterministic PRNG (mulberry32) so a given seed always produces the same corpus.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WINDS: WindValue[] = ["east", "south", "west", "north"];
const DRAGONS = ["haku", "hatsu", "chun"] as const;
const SUITS = ["man", "pin", "sou"] as const;

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

type BagEntry = { tile: Tile; key: string };

// Tracks how many of each tile-type (34 kinds) are already committed to the
// hand under construction, so we never manufacture a 5th copy.
class TileBag {
  counts = new Map<string, number>();

  key(t: Tile): string {
    return t.suit === "honor" ? `honor:${t.value}` : `${t.suit}:${t.value}`;
  }

  available(t: Tile): number {
    return 4 - (this.counts.get(this.key(t)) ?? 0);
  }

  take(t: Tile, aka = false): Tile | null {
    if (this.available(t) <= 0) return null;
    this.counts.set(this.key(t), (this.counts.get(this.key(t)) ?? 0) + 1);
    if (aka && t.suit !== "honor" && (t as SuitedTile).value === 5) {
      return { ...t, isAka: true } as Tile;
    }
    return { ...t };
  }
}

function allTileTypes(): Tile[] {
  const out: Tile[] = [];
  for (const s of SUITS) for (let v = 1; v <= 9; v++) out.push({ suit: s, value: v as SuitedTile["value"] });
  for (const w of WINDS) out.push({ suit: "honor", value: w });
  for (const d of DRAGONS) out.push({ suit: "honor", value: d });
  return out;
}
const ALL_TYPES = allTileTypes();

function randomSequenceStart(rng: () => number): SuitedTile {
  const suit = pick(rng, SUITS);
  const value = (1 + Math.floor(rng() * 7)) as SuitedTile["value"];
  return { suit, value };
}

// Builds one 3-tile group (sequence or triplet) or a pair, pulling from `bag`.
// Returns null if the bag can't support the requested shape (retry upstream).
function buildGroup(
  rng: () => number,
  bag: TileBag,
  kind: "sequence" | "triplet" | "pair",
  allowAka: boolean,
): Tile[] | null {
  if (kind === "sequence") {
    const start = randomSequenceStart(rng);
    const vals = [start.value, (start.value + 1) as SuitedTile["value"], (start.value + 2) as SuitedTile["value"]];
    const tiles: Tile[] = [];
    for (const v of vals) {
      const t = bag.take({ suit: start.suit, value: v }, allowAka && rng() < 0.15);
      if (!t) return null;
      tiles.push(t);
    }
    return tiles;
  }
  const base = pick(rng, ALL_TYPES);
  const n = kind === "pair" ? 2 : 3;
  if (bag.available(base) < n) return null;
  const tiles: Tile[] = [];
  for (let i = 0; i < n; i++) {
    const t = bag.take(base, allowAka && i === 0 && rng() < 0.2);
    if (!t) return null;
    tiles.push(t);
  }
  return tiles;
}

interface GeneratedHand {
  hand: Hand;
  meldTypesUsed: MeldType[];
}

// Builds one complete winning hand: 4 groups + pair (or 7 pairs), with a
// random subset of groups turned into open melds, a random winning tile /
// wait, situational flags, dora indicators, etc.
function generateHand(rng: () => number): GeneratedHand | null {
  const isChiitoitsu = rng() < 0.08;
  const bag = new TileBag();

  if (isChiitoitsu) {
    const pairs: Tile[][] = [];
    for (let i = 0; i < 7; i++) {
      let tries = 0;
      let g: Tile[] | null = null;
      while (!g && tries < 20) {
        g = buildGroup(rng, bag, "pair", true);
        tries++;
      }
      if (!g) return null;
      pairs.push(g);
    }
    const all = pairs.flat();
    const winningTile = pick(rng, pairs)[0];
    const closedTiles = [...all];
    closedTiles.splice(closedTiles.findIndex((t) => tilesEqual(t, winningTile)), 1);
    return finishHand(rng, closedTiles, [], winningTile);
  }

  const groupKinds: ("sequence" | "triplet")[] = [];
  for (let i = 0; i < 4; i++) groupKinds.push(rng() < 0.6 ? "sequence" : "triplet");

  const groups: Tile[][] = [];
  for (const kind of groupKinds) {
    let tries = 0;
    let g: Tile[] | null = null;
    while (!g && tries < 20) {
      g = buildGroup(rng, bag, kind, true);
      tries++;
    }
    if (!g) return null;
    groups.push(g);
  }
  let pair = buildGroup(rng, bag, "pair", true);
  if (!pair) {
    let tries = 0;
    while (!pair && tries < 20) {
      pair = buildGroup(rng, bag, "pair", true);
      tries++;
    }
    if (!pair) return null;
  }

  // Randomly open 0-3 of the 4 groups as chi/pon melds (never the pair; never
  // all 4, since a fully-open hand with no closed groups is still legal but
  // we bias away from it to get more "waiting" shapes).
  const openCount = rng() < 0.45 ? 0 : Math.floor(rng() * 4);
  const order = [0, 1, 2, 3].sort(() => rng() - 0.5);
  const openedIdx = new Set(order.slice(0, openCount));

  const melds: Meld[] = [];
  const closedGroupTiles: Tile[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const isSeq = g.length === 3 && g[0].suit !== "honor" && (g[1] as SuitedTile).value === (g[0] as SuitedTile).value + 1;
    if (openedIdx.has(i)) {
      const type: MeldType = isSeq ? "chi" : "pon";
      melds.push({ type, tiles: g as [Tile, Tile, Tile], calledFrom: isSeq ? "left" : pick(rng, ["left", "opposite", "right"] as const) });
    } else {
      closedGroupTiles.push(...g);
    }
  }

  const closedTiles = [...closedGroupTiles, ...pair];
  // Pick winning tile from the closed portion only (never from an open meld).
  const winningTile = pick(rng, closedTiles);
  const remaining = [...closedTiles];
  remaining.splice(remaining.findIndex((t) => tilesEqual(t, winningTile)), 1);

  return finishHand(rng, remaining, melds, winningTile);
}

function finishHand(rng: () => number, closedTiles: Tile[], melds: Meld[], winningTile: Tile): GeneratedHand {
  const isOpen = melds.length > 0;
  const winType: "tsumo" | "ron" = rng() < 0.5 ? "tsumo" : "ron";
  const seatWind = pick(rng, WINDS);
  const roundWind = pick(rng, WINDS);

  const riichi = !isOpen && rng() < 0.4;
  const doubleRiichi = riichi && rng() < 0.15;
  const ippatsu = riichi && rng() < 0.2;
  const haitei = winType === "tsumo" && rng() < 0.03;
  const houtei = winType === "ron" && rng() < 0.03;
  const rinshan = winType === "tsumo" && !haitei && rng() < 0.03;
  const chankan = winType === "ron" && !houtei && rng() < 0.03;

  const doraCount = Math.floor(rng() * 3);
  const doraIndicators: Tile[] = [];
  for (let i = 0; i < doraCount; i++) doraIndicators.push(pick(rng, ALL_TYPES));

  const uraDoraIndicators: Tile[] = [];
  if (riichi || doubleRiichi) {
    const n = Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) uraDoraIndicators.push(pick(rng, ALL_TYPES));
  }

  const hand: Hand = {
    closedTiles,
    melds,
    winningTile,
    winType,
    seatWind,
    roundWind,
    doraIndicators,
    uraDoraIndicators: uraDoraIndicators.length > 0 ? uraDoraIndicators : undefined,
    riichi,
    doubleRiichi,
    ippatsu,
    haitei,
    houtei,
    rinshan,
    chankan,
  };

  return { hand, meldTypesUsed: melds.map((m) => m.type) };
}

function serializeTile(t: Tile) {
  return t.suit === "honor" ? { suit: "honor", value: t.value } : { suit: t.suit, value: t.value, isAka: (t as SuitedTile).isAka ?? false };
}

describe("fuzz corpus generator (no-op unless GEN_FUZZ=1)", () => {
  it("generates a differential-testing corpus when requested", () => {
    if (!process.env.GEN_FUZZ) {
      expect(true).toBe(true);
      return;
    }

    const rng = mulberry32(SEED);
    const lines: string[] = [];
    let attempts = 0;
    let id = 0;
    while (lines.length < COUNT && attempts < COUNT * 20) {
      attempts++;
      const generated = generateHand(rng);
      if (!generated) continue;
      const { hand } = generated;
      let result;
      try {
        result = score(hand, DEFAULT_RULES);
      } catch (e) {
        result = { valid: false, error: `THROW: ${(e as Error).message}` };
      }

      lines.push(
        JSON.stringify({
          id: id++,
          closedTiles: hand.closedTiles.map(serializeTile),
          melds: hand.melds.map((m) => ({
            type: m.type,
            tiles: m.tiles.map(serializeTile),
          })),
          winningTile: serializeTile(hand.winningTile),
          winType: hand.winType,
          seatWind: hand.seatWind,
          roundWind: hand.roundWind,
          doraIndicators: hand.doraIndicators.map(serializeTile),
          uraDoraIndicators: (hand.uraDoraIndicators ?? []).map(serializeTile),
          riichi: hand.riichi,
          doubleRiichi: hand.doubleRiichi,
          ippatsu: hand.ippatsu,
          haitei: hand.haitei,
          houtei: hand.houtei,
          rinshan: hand.rinshan,
          chankan: hand.chankan,
          ourResult: result,
        }),
      );
    }

    mkdirSync(require("path").dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, lines.join("\n") + "\n");
    // eslint-disable-next-line no-console
    console.log(`Wrote ${lines.length} hands to ${OUT_PATH} (${attempts} attempts)`);
    expect(lines.length).toBeGreaterThan(0);
  });
});
