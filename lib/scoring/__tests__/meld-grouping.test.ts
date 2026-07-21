import { describe, it, expect } from "vitest";
import { groupTilesIntoMelds } from "../meld-grouping";
import type { Tile } from "../types";

const m = (v: number, aka = false): Tile => ({ suit: "man", value: v as any, ...(aka ? { isAka: true } : {}) });
const p = (v: number): Tile => ({ suit: "pin", value: v as any });
const s = (v: number): Tile => ({ suit: "sou", value: v as any });
const wind = (v: "east" | "south" | "west" | "north"): Tile => ({ suit: "honor", value: v });

describe("groupTilesIntoMelds", () => {
  it("groups 3 identical as an open pon", () => {
    const { melds, ungrouped } = groupTilesIntoMelds([s(5), s(5), s(5)]);
    expect(ungrouped).toEqual([]);
    expect(melds).toHaveLength(1);
    expect(melds[0].type).toBe("pon");
  });

  it("groups a run of 3 as a chi", () => {
    const { melds, ungrouped } = groupTilesIntoMelds([m(3), m(4), m(2)]);
    expect(ungrouped).toEqual([]);
    expect(melds).toHaveLength(1);
    expect(melds[0].type).toBe("chi");
    // stored in ascending order
    expect(melds[0].tiles.map((t) => (t as any).value)).toEqual([2, 3, 4]);
  });

  it("groups 4 identical as an open kan", () => {
    const { melds } = groupTilesIntoMelds([p(1), p(1), p(1), p(1)]);
    expect(melds).toHaveLength(1);
    expect(melds[0].type).toBe("kan-open");
    expect(melds[0].tiles).toHaveLength(4);
  });

  it("groups 2 identical as a closed kan, synthesizing the face-down pair", () => {
    const { melds, ungrouped } = groupTilesIntoMelds([wind("west"), wind("west")]);
    expect(ungrouped).toEqual([]);
    expect(melds).toHaveLength(1);
    expect(melds[0].type).toBe("kan-closed");
    expect(melds[0].tiles).toHaveLength(4); // 2 visible + 2 synthesized
    expect(melds[0].tiles.every((t) => t.suit === "honor" && (t as any).value === "west")).toBe(true);
  });

  it("partitions multiple melds (chi + pon) from one flat list", () => {
    const { melds, ungrouped } = groupTilesIntoMelds([s(3), s(4), s(5), s(5), s(5), s(5)]);
    expect(ungrouped).toEqual([]);
    const types = melds.map((x) => x.type).sort();
    expect(types).toEqual(["chi", "pon"]);
  });

  it("partitions two pons", () => {
    const { melds, ungrouped } = groupTilesIntoMelds([m(2), m(2), m(2), p(7), p(7), p(7)]);
    expect(ungrouped).toEqual([]);
    expect(melds.filter((x) => x.type === "pon")).toHaveLength(2);
  });

  it("prefers the all-faces-up kan reading over pon-plus-leftover", () => {
    const { melds, ungrouped } = groupTilesIntoMelds([s(9), s(9), s(9), s(9)]);
    expect(ungrouped).toEqual([]);
    expect(melds).toHaveLength(1);
    expect(melds[0].type).toBe("kan-open");
  });

  it("preserves the aka flag on a red five inside a meld", () => {
    const { melds } = groupTilesIntoMelds([m(5, true), m(5), m(5)]);
    expect(melds[0].type).toBe("pon");
    expect(melds[0].tiles.some((t) => (t as any).isAka === true)).toBe(true);
  });

  it("returns unresolvable tiles as ungrouped rather than dropping them", () => {
    // A lone tile that can't complete any meld (e.g. a dropped detection).
    const { melds, ungrouped } = groupTilesIntoMelds([s(1), s(2), s(3), m(4)]);
    expect(melds.map((x) => x.type)).toEqual(["chi"]);
    expect(ungrouped).toEqual([m(4)]);
  });

  it("handles an empty input", () => {
    expect(groupTilesIntoMelds([])).toEqual({ melds: [], ungrouped: [] });
  });
});
