import { describe, it, expect } from "vitest";
import { fillMissingHandWithHaku } from "../haku-fallback";
import type { Tile } from "../types";

const m = (v: number): Tile => ({ suit: "man", value: v as any });
const haku = (): Tile => ({ suit: "honor", value: "haku" });
const hatsu = (): Tile => ({ suit: "honor", value: "hatsu" });

const countHaku = (tiles: Tile[]) =>
  tiles.filter((t) => t.suit === "honor" && t.value === "haku").length;

// 11 non-haku tiles (a convenient "short by 2" base).
const eleven = (): Tile[] => [m(1), m(2), m(3), m(4), m(5), m(6), m(7), m(8), m(9), m(1), m(2)];

describe("fillMissingHandWithHaku", () => {
  it("fills a shortfall of 2 with two haku", () => {
    const out = fillMissingHandWithHaku(eleven());
    expect(out).toHaveLength(13);
    expect(countHaku(out)).toBe(2);
  });

  it("fills a shortfall of 3 (pon) and 4 (kan)", () => {
    expect(countHaku(fillMissingHandWithHaku(eleven().slice(0, 10)))).toBe(3);
    expect(countHaku(fillMissingHandWithHaku(eleven().slice(0, 9)))).toBe(4);
  });

  it("does NOT fire on a shortfall of 1 (too ambiguous)", () => {
    const twelve = [...eleven(), m(3)];
    expect(fillMissingHandWithHaku(twelve)).toHaveLength(12);
    expect(countHaku(fillMissingHandWithHaku(twelve))).toBe(0);
  });

  it("does NOT fire on a full hand", () => {
    const thirteen = [...eleven(), m(3), m(4)];
    expect(fillMissingHandWithHaku(thirteen)).toBe(thirteen);
  });

  it("does NOT fire on a shortfall of 5+ (implausible as one haku group)", () => {
    const eight = eleven().slice(0, 8);
    expect(fillMissingHandWithHaku(eight)).toHaveLength(8);
    expect(countHaku(fillMissingHandWithHaku(eight))).toBe(0);
  });

  it("adds the full shortfall when doing so stays within 4 haku", () => {
    // 11 tiles incl. 1 detected haku, short by 2: add 2 more -> 3 haku total
    // (<= 4), a haku pon the scan caught one of and missed the other two.
    const withOneHaku = [...eleven().slice(0, 10), haku()];
    const out = fillMissingHandWithHaku(withOneHaku);
    expect(countHaku(out)).toBe(3);
    expect(out).toHaveLength(13);
  });

  it("never exceeds 4 haku even if the arithmetic would", () => {
    // 10 tiles incl. 3 detected haku, short by 3: only 1 slot left (4 max).
    const withThreeHaku = [...eleven().slice(0, 7), haku(), haku(), haku()];
    const out = fillMissingHandWithHaku(withThreeHaku);
    expect(countHaku(out)).toBe(4);
    expect(out).toHaveLength(11);
  });

  it("leaves other honors untouched", () => {
    const withHatsu = [...eleven().slice(0, 9), hatsu(), hatsu()];
    const out = fillMissingHandWithHaku(withHatsu);
    expect(out.filter((t) => t.suit === "honor" && t.value === "hatsu")).toHaveLength(2);
    expect(countHaku(out)).toBe(2);
  });

  it("respects a smaller target when melds shrink the concealed hand", () => {
    // A hand with one called pon only needs 10 concealed tiles (13 - 3).
    // Scanning 8 of those (short by 2 against the *reduced* target, not 13)
    // should add 2 haku, not treat it as short-by-5 against a flat 13.
    const eight = eleven().slice(0, 8);
    const out = fillMissingHandWithHaku(eight, 10);
    expect(out).toHaveLength(10);
    expect(countHaku(out)).toBe(2);
  });

  it("does not fabricate haku once melds already make the hand full", () => {
    // 10 concealed tiles + one pon (3 tiles) = 13: nothing missing.
    const ten = [...eleven().slice(0, 9), m(3)];
    expect(fillMissingHandWithHaku(ten, 10)).toBe(ten);
  });

  it("does not mutate the input array", () => {
    const input = eleven();
    const len = input.length;
    fillMissingHandWithHaku(input);
    expect(input).toHaveLength(len);
  });
});
