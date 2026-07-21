import type { Hand, ScoreResult, RulesConfig, Yaku } from "./types";
import { DEFAULT_RULES } from "./types";
import { parseHand } from "./hand-parser";
import { detectYaku, detectYakuman } from "./yaku";
import { calculateFu, chiitoitsiFuBreakdown } from "./fu";
import { calculatePoints, handName } from "./points";
import { countDora, countAkaDora, doraFromIndicator, tilesEqual, isSuited } from "./tiles";
import type { HandInterpretation } from "./hand-parser";
import type { FuBreakdown } from "./types";

// Sum of only the isYakuman-flagged yaku's han, divided into 13-han units.
// A single yakuman is 1 unit; a doubled yakuman (han: 26) or two distinct
// yakuman stacked on one hand are both 2 units; each further win multiplies
// the payout again. Non-yakuman yaku (including kazoe-yakuman's regular han)
// never contribute here - kazoe-yakuman always pays flat single, unlike real
// yakuman which multiply per unit.
function yakumanUnits(allYaku: Yaku[]): number {
  const han = allYaku.filter((y) => y.isYakuman).reduce((sum, y) => sum + y.han, 0);
  return Math.round(han / 13);
}

function bestInterpretation(
  interpretations: HandInterpretation[],
  hand: Hand,
  rules: RulesConfig,
): { interp: HandInterpretation; fu: FuBreakdown; yaku: Yaku[]; han: number } {
  let best: { interp: HandInterpretation; fu: FuBreakdown; yaku: Yaku[]; han: number } | null = null;

  for (const interp of interpretations) {
    const parsed = { type: "standard" as const, interpretation: interp };
    const yakuList = detectYaku(hand, parsed, rules);
    const yakumanList = detectYakuman(hand, parsed, rules);
    const allYaku = [...yakuList, ...yakumanList];

    const isPinfu = yakuList.some((y) => y.name === "pinfu");
    const fu = calculateFu(
      interp,
      hand.melds,
      hand.seatWind,
      hand.roundWind,
      hand.winType,
      isPinfu,
      rules,
    );

    const structuralHan = allYaku.reduce((sum, y) => sum + y.han, 0);

    if (!best || structuralHan > best.han || (structuralHan === best.han && fu.total > best.fu.total)) {
      best = { interp, fu, yaku: allYaku, han: structuralHan };
    }
  }

  return best!;
}

// Scores a standard-hand grouping; returns null if no yaku applies (can't win on this shape).
function scoreStandardInterpretations(
  interpretations: HandInterpretation[],
  hand: Hand,
  rules: RulesConfig,
  doraCount: number,
  akaDoraCount: number,
  uraDoraCount: number,
  isDealer: boolean,
): ScoreResult | null {
  const { fu, yaku: allYaku, han: structuralHan } = bestInterpretation(interpretations, hand, rules);
  const isYakuman = allYaku.some((y) => y.isYakuman);

  if (!isYakuman && allYaku.filter((y) => !y.isYakuman).length === 0) {
    return null;
  }

  const totalHan = structuralHan + doraCount + uraDoraCount;
  const units = yakumanUnits(allYaku);
  const name = handName(totalHan, fu.total, units, rules.kiriagemangan);
  const points = calculatePoints(totalHan, fu.total, isDealer, hand.winType, units, rules.kiriagemangan);

  return {
    valid: true,
    yaku: allYaku,
    totalHan: structuralHan,
    fu: fu.total,
    fuBreakdown: fu,
    doraCount,
    akaDoraCount,
    uraDoraCount,
    points,
    handName: name,
  };
}

export function score(hand: Hand, rulesOverride?: Partial<RulesConfig>): ScoreResult {
  const rules: RulesConfig = { ...DEFAULT_RULES, ...rulesOverride };

  // Collect all tiles for dora counting
  const allClosedWithWin = [...hand.closedTiles, hand.winningTile];
  const allMeldTiles = hand.melds.flatMap((m) => m.tiles);
  const allTiles = [...allClosedWithWin, ...allMeldTiles];

  const akaDoraCount = countAkaDora(allTiles);
  const doraCount = countDora(allTiles, hand.doraIndicators) + akaDoraCount;
  const uraDoraCount =
    (hand.riichi || hand.doubleRiichi) && hand.uraDoraIndicators
      ? countDora(allTiles, hand.uraDoraIndicators)
      : 0;

  const parsed = parseHand(hand.closedTiles, hand.melds, hand.winningTile);

  if (parsed.type === "invalid") {
    return {
      valid: false,
      error: parsed.reason,
      yaku: [],
      totalHan: 0,
      fu: 0,
      fuBreakdown: { base: 0, pairFu: 0, meldFu: 0, waitFu: 0, tsumoFu: 0, total: 0 },
      doraCount,
      akaDoraCount,
      uraDoraCount,
      points: { total: 0 },
    };
  }

  const isDealer = hand.seatWind === "east";

  if (parsed.type === "kokushi") {
    const yakuList: Yaku[] = [];
    const yakumanList = detectYakuman(hand, { type: "kokushi", interp: parsed }, rules);
    const situationalYaku: Yaku[] = [];
    if (hand.riichi) situationalYaku.push({ name: "riichi", nameJa: "立直", han: 1, isYakuman: false });
    if (hand.doubleRiichi) situationalYaku.push({ name: "double-riichi", nameJa: "ダブル立直", han: 2, isYakuman: false });

    const allYaku = [...yakumanList, ...situationalYaku];
    // Situational yaku (riichi etc.) never scale a yakuman's payout - only
    // stacking further yakuman does. totalHan reflects that: it's the
    // yakuman's own han (13, or 26 if doubled), not the situational extras.
    const totalHan = yakumanList.reduce((sum, y) => sum + y.han, 0);

    // Yakuman fu is irrelevant for points but we return 30 as convention
    const fuBreakdown: FuBreakdown = { base: 30, pairFu: 0, meldFu: 0, waitFu: 0, tsumoFu: 0, total: 30 };
    const points = calculatePoints(totalHan, 30, isDealer, hand.winType, yakumanUnits(allYaku), rules.kiriagemangan);

    return {
      valid: true,
      yaku: allYaku,
      totalHan,
      fu: 30,
      fuBreakdown,
      doraCount,
      akaDoraCount,
      uraDoraCount,
      points,
      handName: "yakuman",
    };
  }

  if (parsed.type === "chiitoitsu") {
    const parsedForYaku = { type: "chiitoitsu" as const, interp: parsed };
    const yakuList = detectYaku(hand, parsedForYaku, rules);
    const yakumanList = detectYakuman(hand, parsedForYaku, rules);
    const allYaku = [...yakuList, ...yakumanList];

    if (allYaku.filter((y) => !y.isYakuman).length === 0 && yakumanList.length === 0) {
      // Only chiitoitsu itself counts; ensure it's there
    }

    const structuralHan = allYaku.reduce((sum, y) => sum + y.han, 0);
    const totalHan = structuralHan + doraCount + uraDoraCount;

    const fuBreakdown = chiitoitsiFuBreakdown();
    const units = yakumanUnits(allYaku);
    const name = handName(totalHan, 25, units, rules.kiriagemangan);
    const points = calculatePoints(totalHan, 25, isDealer, hand.winType, units, rules.kiriagemangan);

    const chiitoitsuResult: ScoreResult = {
      valid: true,
      yaku: allYaku,
      totalHan: structuralHan,
      fu: 25,
      fuBreakdown,
      doraCount,
      akaDoraCount,
      uraDoraCount,
      points,
      handName: name,
    };

    // Some seven-pairs shapes (e.g. ryanpeikou) also parse as a standard hand
    // worth more - score both and keep whichever pays out more.
    if (parsed.standardAlt) {
      const standardResult = scoreStandardInterpretations(
        parsed.standardAlt,
        hand,
        rules,
        doraCount,
        akaDoraCount,
        uraDoraCount,
        isDealer,
      );
      if (standardResult && standardResult.points.total > chiitoitsuResult.points.total) {
        return standardResult;
      }
    }

    return chiitoitsuResult;
  }

  // Standard hand
  const { interp, fu, yaku: allYaku, han: structuralHan } = bestInterpretation(
    parsed.interpretations,
    hand,
    rules,
  );

  const isYakuman = allYaku.some((y) => y.isYakuman);

  if (!isYakuman && allYaku.filter((y) => !y.isYakuman).length === 0) {
    // No yaku - check if dora saves it (no, dora doesn't give yaku)
    // Actually need at least one yaku to win
    return {
      valid: false,
      error: "No yaku",
      yaku: [],
      totalHan: 0,
      fu: fu.total,
      fuBreakdown: fu,
      doraCount,
      akaDoraCount,
      uraDoraCount,
      points: { total: 0 },
    };
  }

  const totalHan = structuralHan + doraCount + uraDoraCount;
  const units = yakumanUnits(allYaku);
  const name = handName(totalHan, fu.total, units, rules.kiriagemangan);
  const points = calculatePoints(totalHan, fu.total, isDealer, hand.winType, units, rules.kiriagemangan);

  return {
    valid: true,
    yaku: allYaku,
    totalHan: structuralHan,
    fu: fu.total,
    fuBreakdown: fu,
    doraCount,
    akaDoraCount,
    uraDoraCount,
    points,
    handName: name,
  };
}
