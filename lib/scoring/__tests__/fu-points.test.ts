import { describe, it, expect } from "vitest";
import { handName, calculatePoints } from "../points";
import { score } from "../index";
import type { Hand, Tile, Meld } from "../types";

const m = (v: number): Tile => ({ suit: "man", value: v as any });
const p = (v: number): Tile => ({ suit: "pin", value: v as any });
const s = (v: number): Tile => ({ suit: "sou", value: v as any });
const dragon = (v: "haku" | "hatsu" | "chun"): Tile => ({ suit: "honor", value: v });

function makeHand(closedTiles: Tile[], winningTile: Tile, overrides: Partial<Hand> = {}): Hand {
  return {
    melds: [],
    winType: "tsumo",
    seatWind: "south",
    roundWind: "east",
    doraIndicators: [],
    riichi: false,
    doubleRiichi: false,
    ippatsu: false,
    haitei: false,
    houtei: false,
    rinshan: false,
    chankan: false,
    closedTiles,
    winningTile,
    ...overrides,
  };
}

// ─── handName: mangan threshold ───────────────────────────────────────────────

describe("handName — mangan thresholds", () => {
  // Below 2000 basic points → no cap
  it("4h 20f → undefined  (basic 1280)", () => expect(handName(4, 20, false, false)).toBeUndefined());
  it("4h 30f → undefined  (basic 1920 < 2000)", () => expect(handName(4, 30, false, false)).toBeUndefined());
  it("3h 50f → undefined  (basic 1600)", () => expect(handName(3, 50, false, false)).toBeUndefined());
  it("3h 60f → undefined  (basic 1920 < 2000)", () => expect(handName(3, 60, false, false)).toBeUndefined());

  // At or above 2000 basic points → mangan
  it("4h 40f → mangan     (basic 2560 ≥ 2000)", () => expect(handName(4, 40, false, false)).toBe("mangan"));
  it("4h 60f → mangan     (basic 3840 ≥ 2000)", () => expect(handName(4, 60, false, false)).toBe("mangan"));
  it("3h 70f → mangan     (basic 2240 ≥ 2000)", () => expect(handName(3, 70, false, false)).toBe("mangan"));
  it("3h 80f → mangan     (basic 2560 ≥ 2000)", () => expect(handName(3, 80, false, false)).toBe("mangan"));

  // Kiriagemangan rounds up sub-2000 cases
  it("4h 30f kiriagemangan → mangan", () => expect(handName(4, 30, false, true)).toBe("mangan"));
  it("3h 60f kiriagemangan → mangan", () => expect(handName(3, 60, false, true)).toBe("mangan"));

  // Higher limits
  it("5h → mangan",    () => expect(handName(5, 20, false, false)).toBe("mangan"));
  it("6h → haneman",   () => expect(handName(6, 20, false, false)).toBe("haneman"));
  it("7h → haneman",   () => expect(handName(7, 20, false, false)).toBe("haneman"));
  it("8h → baiman",    () => expect(handName(8, 20, false, false)).toBe("baiman"));
  it("11h → sanbaiman",() => expect(handName(11, 20, false, false)).toBe("sanbaiman"));
  it("13h → kazoe-yakuman", () => expect(handName(13, 20, false, false)).toBe("kazoe-yakuman"));
});

// ─── calculatePoints: payment correctness at mangan boundaries ────────────────

describe("calculatePoints — mangan boundary payments (non-dealer)", () => {
  it("4h 40f ron = 8000 mangan", () => {
    expect(calculatePoints(4, 40, false, "ron", false, false).total).toBe(8000);
  });

  it("4h 40f tsumo = 8000 mangan (dealer 4000, each non-dealer 2000)", () => {
    const pts = calculatePoints(4, 40, false, "tsumo", false, false);
    expect(pts.total).toBe(8000);
    expect(pts.tsumo?.dealerPays).toBe(4000);
    expect(pts.tsumo?.nonDealerPays).toBe(2000);
  });

  it("3h 70f ron = 8000 mangan", () => {
    expect(calculatePoints(3, 70, false, "ron", false, false).total).toBe(8000);
  });

  // 4h 30f: basic=1920, roundUp100(1920×4)=7700 — NOT mangan without kiriagemangan
  it("4h 30f ron, no kiriagemangan = 7700 (below mangan)", () => {
    expect(calculatePoints(4, 30, false, "ron", false, false).total).toBe(7700);
  });

  it("4h 30f ron, kiriagemangan = 8000", () => {
    expect(calculatePoints(4, 30, false, "ron", false, true).total).toBe(8000);
  });

  // 3h 60f: basic=1920 — same boundary as 4h 30f
  it("3h 60f ron, no kiriagemangan = 7700 (below mangan)", () => {
    expect(calculatePoints(3, 60, false, "ron", false, false).total).toBe(7700);
  });

  it("3h 60f ron, kiriagemangan = 8000", () => {
    expect(calculatePoints(3, 60, false, "ron", false, true).total).toBe(8000);
  });
});

// ─── fu base: tsumo=20, closed ron=30, open=20 ───────────────────────────────

describe("fu base — tsumo uses 20, closed ron uses 30, open uses 20", () => {
  // Non-pinfu tsumo: not pinfu because of yakuhai (haku) pair.
  // Groups: 234m 234p 567p 56s(wait), pair: haku haku
  // fu: base 20 + tsumo 2 + haku pair 2 + ryanmen 0 = 24 → 30
  it("non-pinfu tsumo: base=20, total fu=30", () => {
    const result = score(makeHand(
      [m(2), m(3), m(4), p(2), p(3), p(4), p(5), p(6), p(7), s(5), s(6), dragon("haku"), dragon("haku")],
      s(7),
      { winType: "tsumo" },
    ));
    expect(result.valid).toBe(true);
    expect(result.fuBreakdown.base).toBe(20);
    expect(result.fu).toBe(30);
  });

  // Same hand, ron: base=30 (menzen bonus), pair 2, ryanmen 0 = 32 → 40
  it("closed ron: base=30 (menzen bonus), total fu=40", () => {
    const result = score(makeHand(
      [m(2), m(3), m(4), p(2), p(3), p(4), p(5), p(6), p(7), s(5), s(6), dragon("haku"), dragon("haku")],
      s(7),
      { winType: "ron", riichi: true },
    ));
    expect(result.valid).toBe(true);
    expect(result.fuBreakdown.base).toBe(30);
    expect(result.fu).toBe(40);
  });

  // Tsumo with closed terminal triplet (ankou 1m=8fu) + kanchan wait (2fu)
  // Groups: 111m(ankou) 234p 567p 3s_5s(kanchan→4s), pair: 8s8s
  // fu: base 20 + tsumo 2 + ankou terminal 8 + kanchan 2 + pair 0 = 32 → 40
  it("tsumo with terminal ankou + kanchan: base=20, total fu=40", () => {
    const result = score(makeHand(
      [m(1), m(1), m(1), p(2), p(3), p(4), p(5), p(6), p(7), s(3), s(5), s(8), s(8)],
      s(4),
      { winType: "tsumo", riichi: true },
    ));
    expect(result.valid).toBe(true);
    expect(result.fuBreakdown.base).toBe(20);
    expect(result.fu).toBe(40);
  });

  // Open tsumo (chi meld) — base must be 20, not 30.
  // Meld: 234m(chi). Groups: 567m 234p 56s(ryanmen→7s), pair: 8s8s
  // fu: base 20 + tsumo 2 + chi 0 + seqs 0 + ryanmen 0 + pair 0 = 22 → 30
  it("open tsumo (chi): base=20, total fu=30", () => {
    const chi: Meld = { type: "chi", tiles: [m(2), m(3), m(4)] };
    const result = score(makeHand(
      [m(5), m(6), m(7), p(2), p(3), p(4), s(5), s(6), s(8), s(8)],
      s(7),
      { winType: "tsumo", melds: [chi] },
    ));
    expect(result.valid).toBe(true);
    expect(result.fuBreakdown.base).toBe(20);
    expect(result.fu).toBe(30);
  });

  // Open ron (pon of haku) — base must be 20, not 30.
  // Meld: haku pon (open honor, 4fu). Groups: 234m 567p 23s(ryanmen→4s), pair: 8s8s
  // fu: base 20 + pon honor open 4 + seqs 0 + ryanmen 0 + pair 0 = 24 → 30
  it("open ron (pon of haku): base=20, total fu=30", () => {
    const pon: Meld = { type: "pon", tiles: [dragon("haku"), dragon("haku"), dragon("haku")] };
    const result = score(makeHand(
      [m(2), m(3), m(4), p(5), p(6), p(7), s(2), s(3), s(8), s(8)],
      s(4),
      { winType: "ron", melds: [pon] },
    ));
    expect(result.valid).toBe(true);
    expect(result.fuBreakdown.base).toBe(20);
    expect(result.fu).toBe(30);
  });
});
