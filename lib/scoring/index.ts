import type { Hand, ScoreResult, RulesConfig, Yaku } from "./types";
import { DEFAULT_RULES } from "./types";
import { parseHand } from "./hand-parser";
import { detectYaku, detectYakuman } from "./yaku";
import { calculateFu, chiitoitsiFuBreakdown } from "./fu";
import { calculatePoints, handName } from "./points";
import { countDora, countAkaDora, doraFromIndicator, tilesEqual, isSuited } from "./tiles";
import type { HandInterpretation } from "./hand-parser";
import type { FuBreakdown } from "./types";

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
    const yakumanHan = 13;
    const totalHan = yakumanHan;

    // Yakuman fu is irrelevant for points but we return 30 as convention
    const fuBreakdown: FuBreakdown = { base: 30, pairFu: 0, meldFu: 0, waitFu: 0, tsumoFu: 0, total: 30 };
    const points = calculatePoints(totalHan, 30, isDealer, hand.winType, true, rules.kiriagemangan);

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

    const isYakuman = yakumanList.length > 0;
    const structuralHan = allYaku.reduce((sum, y) => sum + y.han, 0);
    const totalHan = structuralHan + doraCount + uraDoraCount;

    const fuBreakdown = chiitoitsiFuBreakdown();
    const name = handName(totalHan, 25, isYakuman, rules.kiriagemangan);
    const points = calculatePoints(totalHan, 25, isDealer, hand.winType, isYakuman, rules.kiriagemangan);

    return {
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
  }

  // Standard hand
  const { interp, fu, yaku: allYaku, han: structuralHan } = bestInterpretation(
    parsed.interpretations,
    hand,
    rules,
  );

  const isYakuman = allYaku.some((y) => y.isYakuman);

  if (!isYakuman && allYaku.filter((y) => !y.isYakuman).length === 0) {
    // No yaku — check if dora saves it (no, dora doesn't give yaku)
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
  const name = handName(totalHan, fu.total, isYakuman, rules.kiriagemangan);
  const points = calculatePoints(totalHan, fu.total, isDealer, hand.winType, isYakuman, rules.kiriagemangan);

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
