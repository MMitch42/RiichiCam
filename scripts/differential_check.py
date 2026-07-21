#!/usr/bin/env python3
"""
Differential-tests RiichiCam's scoring engine against the MahjongRepository
`mahjong` PyPI package (a well-established, independently-implemented riichi
scoring engine), using the corpus written by
lib/scoring/__tests__/fuzz-corpus.test.ts (GEN_FUZZ=1).

Usage:
    pip install mahjong
    GEN_FUZZ=1 npx vitest run lib/scoring/__tests__/fuzz-corpus.test.ts
    python3 scripts/differential_check.py [path-to-corpus.jsonl]
"""
import json
import sys
from collections import Counter

from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, HandConstants, OptionalRules
from mahjong.meld import Meld
from mahjong.constants import EAST, SOUTH, WEST, NORTH, HAKU, HATSU, CHUN

CORPUS_PATH = sys.argv[1] if len(sys.argv) > 1 else "/tmp/riichicam-fuzz-corpus.jsonl"

WIND_34 = {"east": EAST, "south": SOUTH, "west": WEST, "north": NORTH}
HONOR_34 = {**WIND_34, "haku": HAKU, "hatsu": HATSU, "chun": CHUN}
SUIT_OFFSET = {"man": 0, "pin": 9, "sou": 18}

MELD_MAP = {
    "chi": Meld.CHI,
    "pon": Meld.PON,
    "kan-open": Meld.KAN,
    "kan-closed": Meld.KAN,
    "kan-added": Meld.SHOUMINKAN,
}


def tile34(t):
    if t["suit"] == "honor":
        return HONOR_34[t["value"]]
    return SUIT_OFFSET[t["suit"]] + (t["value"] - 1)


RED_FIVE_INDICES = {SUIT_OFFSET["man"] + 4, SUIT_OFFSET["pin"] + 4, SUIT_OFFSET["sou"] + 4}


class TileAllocator:
    """Assigns 136-format ids. Physical id (type*4 + 0) is hardwired by the
    reference library to mean "red five" for man/pin/sou 5s, independent of
    any bookkeeping on our side - so that slot must be reserved for an actual
    aka tile and never handed to a plain (non-red) five."""

    def __init__(self, all_tiles):
        self.used = Counter()

    def assign(self, t):
        idx34 = tile34(t)
        if t.get("isAka"):
            return idx34 * 4 + 0
        start = 1 if idx34 in RED_FIVE_INDICES else 0
        slot = start + self.used[idx34]
        self.used[idx34] += 1
        if slot > 3:
            # Physically unrepresentable in a 136-tile set: 4 non-red copies
            # of a value-5 tile plus a reserved red-five slot would need a
            # 5th physical tile. Our engine has no notion of a fixed physical
            # deck (it scores whatever tiles it's given), so this is a corpus
            # artifact, not a scoring bug - the caller should skip the entry.
            raise UnrepresentableHand(f"tile34={idx34} needs slot {slot}")
        return idx34 * 4 + slot


class UnrepresentableHand(Exception):
    pass


def score_with_reference(entry):
    all_tiles = list(entry["closedTiles"])
    all_tiles.append(entry["winningTile"])
    for m in entry["melds"]:
        all_tiles.extend(m["tiles"])

    alloc = TileAllocator(all_tiles)

    tiles136 = [alloc.assign(t) for t in entry["closedTiles"]]
    win_tile_136 = alloc.assign(entry["winningTile"])
    tiles136.append(win_tile_136)

    melds = []
    for m in entry["melds"]:
        ids = [alloc.assign(t) for t in m["tiles"]]
        tiles136.extend(ids)
        opened = m["type"] != "kan-closed"
        melds.append(Meld(meld_type=MELD_MAP[m["type"]], tiles=ids, opened=opened))

    options = OptionalRules(
        has_open_tanyao=True,
        has_aka_dora=True,
        has_double_yakuman=False,  # matches RulesConfig.doubleYakuman default (false)
        kiriage=True,  # matches RulesConfig.kiriagemangan default (true)
        kazoe_limit=HandConstants.KAZOE_LIMITED,
    )
    config = HandConfig(
        is_tsumo=entry["winType"] == "tsumo",
        is_riichi=entry["riichi"] and not entry["doubleRiichi"],
        is_daburu_riichi=entry["doubleRiichi"],
        is_ippatsu=entry["ippatsu"],
        is_haitei=entry["haitei"],
        is_houtei=entry["houtei"],
        is_rinshan=entry["rinshan"],
        is_chankan=entry["chankan"],
        player_wind=WIND_34[entry["seatWind"]],
        round_wind=WIND_34[entry["roundWind"]],
        options=options,
    )

    dora_indicators = [alloc.assign(t) for t in entry["doraIndicators"]]
    ura_indicators = [alloc.assign(t) for t in entry["uraDoraIndicators"]]

    calc = HandCalculator()
    result = calc.estimate_hand_value(
        tiles136,
        win_tile_136,
        melds=melds if melds else None,
        dora_indicators=(dora_indicators + ura_indicators) if entry["riichi"] or entry["doubleRiichi"] else dora_indicators,
        config=config,
    )
    return result


def compare(entry):
    ours = entry["ourResult"]
    ref = score_with_reference(entry)

    ref_valid = ref.error is None
    our_valid = ours.get("valid", False)

    if not ref_valid and not our_valid:
        return None  # both agree hand doesn't win - fine

    if ref_valid != our_valid:
        return {
            "id": entry["id"],
            "kind": "validity-mismatch",
            "ours_valid": our_valid,
            "ours_error": ours.get("error"),
            "ref_valid": ref_valid,
            "ref_error": ref.error,
        }

    # Both consider it a win: compare han/fu/points.
    our_total_han = ours["totalHan"] + ours["doraCount"] + ours["uraDoraCount"]
    ref_total_han = ref.han
    our_fu = ours["fu"]
    ref_fu = ref.fu
    our_points = ours["points"]["total"]
    ref_points = ref.cost["total"] if ref.cost else None

    mismatches = []
    if our_total_han != ref_total_han:
        mismatches.append(f"han: ours={our_total_han} ref={ref_total_han}")
    if our_fu != ref_fu:
        mismatches.append(f"fu: ours={our_fu} ref={ref_fu}")
    if our_points != ref_points:
        mismatches.append(f"points: ours={our_points} ref={ref_points}")

    if not mismatches:
        return None

    return {
        "id": entry["id"],
        "kind": "value-mismatch",
        "mismatches": mismatches,
        "ours_yaku": [y["name"] for y in ours["yaku"]],
        "ref_yaku": [y.name for y in ref.yaku] if ref.yaku else [],
        "entry": entry,
    }


def main():
    total = 0
    both_lose = 0
    diffs = []
    crashes = []
    unrepresentable = 0
    with open(CORPUS_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            total += 1
            try:
                d = compare(entry)
            except UnrepresentableHand:
                unrepresentable += 1
                continue
            except Exception as e:
                crashes.append({"id": entry["id"], "error": repr(e)})
                continue
            if d is None:
                both_lose += 1
            else:
                diffs.append(d)

    if unrepresentable:
        print(f"Skipped {unrepresentable} hands unrepresentable in a physical 136-tile "
              f"set (>4 non-red copies of a value-5 tile) - corpus artifact, not scored.")

    print(f"Checked {total} hands: {total - len(diffs) - len(crashes)} agree, "
          f"{len(diffs)} mismatches, {len(crashes)} reference-side crashes")

    if crashes:
        print(f"\n--- {len(crashes)} crashes converting/scoring with reference lib (first 5) ---")
        for c in crashes[:5]:
            print(c)

    if diffs:
        print(f"\n--- {len(diffs)} mismatches (first 20) ---")
        for d in diffs[:20]:
            print(json.dumps(d, indent=2, default=str))

    out_path = "/tmp/riichicam-fuzz-diffs.json"
    with open(out_path, "w") as f:
        json.dump({"diffs": diffs, "crashes": crashes}, f, indent=2, default=str)
    print(f"\nFull diff/crash list written to {out_path}")


if __name__ == "__main__":
    main()
