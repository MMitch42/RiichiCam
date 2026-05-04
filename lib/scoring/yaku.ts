import type { Hand, Tile, Meld, WindValue, SuitedTile, HonorTile, RulesConfig, Yaku, LocalYakuConfig } from "./types";
import type { HandInterpretation, ChiitoitsuInterpretation, KokushiInterpretation, TileGroup } from "./hand-parser";
import {
  isSuited,
  isHonor,
  isTerminal,
  isTerminalOrHonor,
  isWind,
  isDragon,
  tilesEqual,
  sortTiles,
} from "./tiles";

// ─── helpers ──────────────────────────────────────────────────────────────────

function isOpen(melds: Meld[]): boolean {
  return melds.some((m) => m.type !== "kan-closed");
}

function isClosed(melds: Meld[]): boolean {
  return !isOpen(melds);
}

function allTiles(interp: HandInterpretation, melds: Meld[]): Tile[] {
  const closed: Tile[] = [];
  for (const g of interp.groups) closed.push(...g.tiles);
  closed.push(interp.pair, interp.pair);
  for (const m of melds) closed.push(...m.tiles);
  return closed;
}

function allTilesChiitoitsu(interp: ChiitoitsuInterpretation): Tile[] {
  const tiles: Tile[] = [];
  for (const p of interp.pairs) tiles.push(p, p);
  return tiles;
}

function yakuhai(tile: Tile, seatWind: WindValue, roundWind: WindValue): number {
  if (isDragon(tile)) return 1;
  if (isWind(tile)) {
    let han = 0;
    if (tilesEqual(tile, { suit: "honor", value: seatWind })) han++;
    if (tilesEqual(tile, { suit: "honor", value: roundWind })) han++;
    return han;
  }
  return 0;
}

function suitSet(tiles: Tile[]): Set<string> {
  return new Set(tiles.filter(isSuited).map((t) => (t as SuitedTile).suit));
}

// ─── Standard yaku ────────────────────────────────────────────────────────────

export function detectYaku(
  hand: Hand,
  parsed:
    | { type: "standard"; interpretation: HandInterpretation }
    | { type: "chiitoitsu"; interp: ChiitoitsuInterpretation }
    | { type: "kokushi"; interp: KokushiInterpretation },
  rules: RulesConfig,
): Yaku[] {
  const yaku: Yaku[] = [];
  const melds = hand.melds;
  const open = isOpen(melds);

  // ── Situational yaku (always closed) ──────────────────────────────────────

  if (hand.riichi && isClosed(melds)) {
    yaku.push({ name: "riichi", nameJa: "立直", han: 1, isYakuman: false });
  }
  if (hand.doubleRiichi && isClosed(melds)) {
    yaku.push({ name: "double-riichi", nameJa: "ダブル立直", han: 2, isYakuman: false });
  }
  if (hand.ippatsu && (hand.riichi || hand.doubleRiichi)) {
    yaku.push({ name: "ippatsu", nameJa: "一発", han: 1, isYakuman: false });
  }
  if (hand.haitei && hand.winType === "tsumo") {
    yaku.push({ name: "haitei", nameJa: "海底摸月", han: 1, isYakuman: false });
  }
  if (hand.houtei && hand.winType === "ron") {
    yaku.push({ name: "houtei", nameJa: "河底撈魚", han: 1, isYakuman: false });
  }
  if (hand.rinshan) {
    yaku.push({ name: "rinshan", nameJa: "嶺上開花", han: 1, isYakuman: false });
  }
  if (hand.chankan) {
    yaku.push({ name: "chankan", nameJa: "槍槓", han: 1, isYakuman: false });
  }
  if (hand.winType === "tsumo" && isClosed(melds)) {
    yaku.push({ name: "tsumo", nameJa: "門前清自摸和", han: 1, isYakuman: false });
  }

  // ── Special forms ──────────────────────────────────────────────────────────

  if (parsed.type === "chiitoitsu") {
    yaku.push({ name: "chiitoitsu", nameJa: "七対子", han: 2, isYakuman: false });
    return yaku; // chiitoitsu is incompatible with most other structural yaku
  }

  if (parsed.type === "kokushi") {
    // Kokushi is a yakuman, handled separately
    return yaku;
  }

  const interp = parsed.interpretation;

  // ── Structural yaku ───────────────────────────────────────────────────────

  const tiles = allTiles(interp, melds);

  // Tanyao
  const hasTanyao = tiles.every((t) => !isTerminalOrHonor(t));
  if (hasTanyao && (rules.kuitan || isClosed(melds))) {
    yaku.push({ name: "tanyao", nameJa: "断么九", han: 1, isYakuman: false });
  }

  // Pinfu: all sequences, pair not yakuhai, two-sided wait (ryanmen)
  const isPinfu =
    isClosed(melds) &&
    interp.groups.every((g) => g.type === "sequence") &&
    yakuhai(interp.pair, hand.seatWind, hand.roundWind) === 0 &&
    interp.waitType === "ryanmen";
  if (isPinfu) {
    yaku.push({ name: "pinfu", nameJa: "平和", han: 1, isYakuman: false });
  }

  // Iipeiko: two identical sequences (closed only)
  if (isClosed(melds)) {
    const seqs = [...interp.groups.filter((g) => g.type === "sequence"), ...melds.filter((m) => m.type === "chi").map((m) => ({ type: "sequence" as const, tiles: m.tiles }))];
    let iipeiko = false;
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        const a = sortTiles(seqs[i].tiles);
        const b = sortTiles(seqs[j].tiles);
        if (a.every((t, k) => tilesEqual(t, b[k]))) {
          iipeiko = true;
          break;
        }
      }
    }
    if (iipeiko) {
      yaku.push({ name: "iipeiko", nameJa: "一盃口", han: 1, isYakuman: false });
    }
  }

  // Yakuhai (value tiles): dragons + seat/round winds as triplets
  const allTriplets: Tile[][] = [];
  for (const g of interp.groups) {
    if (g.type === "triplet") allTriplets.push(g.tiles);
  }
  for (const m of melds) {
    if (m.type === "pon" || m.type === "kan-open" || m.type === "kan-closed" || m.type === "kan-added") {
      allTriplets.push([...m.tiles]);
    }
  }
  for (const triplet of allTriplets) {
    const rep = triplet[0];
    const han = yakuhai(rep, hand.seatWind, hand.roundWind);
    if (han > 0) {
      yaku.push({ name: "yakuhai", nameJa: "役牌", han, isYakuman: false });
    }
  }

  // Sanshoku doukou: same triplet in all three suits
  const tripletVals = allTriplets
    .filter((t) => isSuited(t[0]))
    .map((t) => ({ suit: (t[0] as SuitedTile).suit, val: (t[0] as SuitedTile).value }));
  for (const tv of tripletVals) {
    if (
      tripletVals.some((x) => x.suit === "man" && x.val === tv.val) &&
      tripletVals.some((x) => x.suit === "pin" && x.val === tv.val) &&
      tripletVals.some((x) => x.suit === "sou" && x.val === tv.val)
    ) {
      yaku.push({ name: "sanshoku-doukou", nameJa: "三色同刻", han: 2, isYakuman: false });
      break;
    }
  }

  // Sanshoku doujun: same sequence in all three suits
  const allSeqs = [
    ...interp.groups.filter((g) => g.type === "sequence"),
    ...melds.filter((m) => m.type === "chi").map((m) => ({ type: "sequence" as const, tiles: m.tiles })),
  ];
  const seqStarts = allSeqs
    .filter((s) => isSuited(s.tiles[0]))
    .map((s) => ({ suit: (s.tiles[0] as SuitedTile).suit, val: Math.min(...s.tiles.filter(isSuited).map((t) => (t as SuitedTile).value)) }));
  for (const ss of seqStarts) {
    if (
      seqStarts.some((x) => x.suit === "man" && x.val === ss.val) &&
      seqStarts.some((x) => x.suit === "pin" && x.val === ss.val) &&
      seqStarts.some((x) => x.suit === "sou" && x.val === ss.val)
    ) {
      const han = open ? 1 : 2;
      yaku.push({ name: "sanshoku-doujun", nameJa: "三色同順", han, isYakuman: false });
      break;
    }
  }

  // Ittsu (straight): 123, 456, 789 in same suit
  const seqsByStart = new Map<string, boolean>();
  for (const s of allSeqs) {
    if (!isSuited(s.tiles[0])) continue;
    const sorted = sortTiles(s.tiles).filter(isSuited) as SuitedTile[];
    seqsByStart.set(`${sorted[0].suit}:${sorted[0].value}`, true);
  }
  for (const suit of ["man", "pin", "sou"] as const) {
    if (seqsByStart.has(`${suit}:1`) && seqsByStart.has(`${suit}:4`) && seqsByStart.has(`${suit}:7`)) {
      const han = open ? 1 : 2;
      yaku.push({ name: "ittsu", nameJa: "一気通貫", han, isYakuman: false });
      break;
    }
  }

  // Toitoi: all triplets (open or closed)
  const allGroups = [
    ...interp.groups,
    ...melds.map((m) => ({ type: m.type === "chi" ? "sequence" : ("triplet" as const), tiles: m.tiles })),
  ];
  if (allGroups.every((g) => g.type === "triplet")) {
    yaku.push({ name: "toitoi", nameJa: "対々和", han: 2, isYakuman: false });
  }

  // Sanankou: three concealed triplets (wins by ron on the completing triplet = 2 concealed only)
  const concealedTriplets = interp.groups.filter((g) => g.type === "triplet");
  // Add closed kans from melds
  const closedKans = melds.filter((m) => m.type === "kan-closed").length;
  const numConcealed = concealedTriplets.length + closedKans;
  // If ron win completes a triplet (shanpon), that triplet is NOT concealed
  const sannankou =
    numConcealed >= 3 &&
    !(hand.winType === "ron" && interp.waitType === "shanpon" && numConcealed === 3);
  if (sannankou && numConcealed >= 3) {
    yaku.push({ name: "sanankou", nameJa: "三暗刻", han: 2, isYakuman: false });
  }

  // Honitsu (half flush): one suit + honors
  const suits = suitSet(tiles);
  const hasOnlySuited = tiles.every(isSuited);
  const hasHonors = tiles.some(isHonor);
  if (suits.size === 1 && hasHonors) {
    const han = open ? 2 : 3;
    yaku.push({ name: "honitsu", nameJa: "混一色", han, isYakuman: false });
  }

  // Chinitsu (full flush): one suit, no honors
  if (suits.size === 1 && !hasHonors) {
    const han = open ? 5 : 6;
    yaku.push({ name: "chinitsu", nameJa: "清一色", han, isYakuman: false });
  }

  // Chanta: every group + pair contains a terminal or honor
  const allGroupsForChanta = [
    ...interp.groups,
    ...melds.map((m) => ({ type: m.type === "chi" ? "sequence" : ("triplet" as const), tiles: m.tiles })),
  ];
  const hasSequence = allGroupsForChanta.some((g) => g.type === "sequence") || melds.some((m) => m.type === "chi");
  const isChanta =
    hasSequence &&
    allGroupsForChanta.every((g) => g.tiles.some(isTerminalOrHonor)) &&
    isTerminalOrHonor(interp.pair);
  if (isChanta && !tiles.every(isTerminalOrHonor)) {
    const han = open ? 1 : 2;
    yaku.push({ name: "chanta", nameJa: "混全帯么九", han, isYakuman: false });
  }

  // Junchan: every group + pair contains a terminal (no honors)
  const isJunchan =
    hasSequence &&
    !hasHonors &&
    allGroupsForChanta.every((g) => g.tiles.some(isTerminal)) &&
    isTerminal(interp.pair);
  if (isJunchan) {
    const han = open ? 2 : 3;
    yaku.push({ name: "junchan", nameJa: "純全帯么九", han, isYakuman: false });
  }

  // Honroutou: all tiles are terminals or honors (mix — not pure honors or pure terminals)
  if (tiles.every(isTerminalOrHonor) && tiles.some(isHonor) && tiles.some((t) => isSuited(t) && isTerminal(t))) {
    yaku.push({ name: "honroutou", nameJa: "混老頭", han: 2, isYakuman: false });
  }

  // Shousangen: pair is dragon + two dragon triplets
  const dragonTripletCount = allTriplets.filter((t) => isDragon(t[0])).length;
  const pairIsDragon = isDragon(interp.pair);
  if (dragonTripletCount === 2 && pairIsDragon) {
    yaku.push({ name: "shousangen", nameJa: "小三元", han: 2, isYakuman: false });
  }

  // Sankantsu: three kans
  const kanCount = melds.filter(
    (m) => m.type === "kan-open" || m.type === "kan-closed" || m.type === "kan-added",
  ).length;
  if (kanCount >= 3) {
    yaku.push({ name: "sankantsu", nameJa: "三槓子", han: 2, isYakuman: false });
  }

  // Ryanpeiko: two sets of iipeiko (closed only)
  if (isClosed(melds)) {
    const seqsList = interp.groups.filter((g) => g.type === "sequence");
    let riyanpeiko = false;
    if (seqsList.length === 4) {
      const keys = seqsList.map((s) =>
        sortTiles(s.tiles)
          .map((t) => `${t.suit}${isSuited(t) ? (t as SuitedTile).value : t.value}`)
          .join(""),
      );
      keys.sort();
      if (keys[0] === keys[1] && keys[2] === keys[3]) {
        riyanpeiko = true;
      }
    }
    if (riyanpeiko) {
      // Remove iipeiko if present, replace with ryanpeiko
      const idx = yaku.findIndex((y) => y.name === "iipeiko");
      if (idx !== -1) yaku.splice(idx, 1);
      yaku.push({ name: "ryanpeiko", nameJa: "二盃口", han: 3, isYakuman: false });
    }
  }

  // ── Local yaku ────────────────────────────────────────────────────────────
  const local: LocalYakuConfig | undefined = rules.localYaku;
  if (local) {
    // Renho: non-dealer wins on first round of discards before their draw
    if (local.renho && hand.renho && hand.seatWind !== "east") {
      yaku.push({ name: "renho", nameJa: "人和", han: 5, isYakuman: false });
    }

    // Iipinmoyue: win by tsumo on 1-pin
    if (local.iipinmoyue && hand.winType === "tsumo" &&
        isSuited(hand.winningTile) && (hand.winningTile as SuitedTile).suit === "pin" &&
        (hand.winningTile as SuitedTile).value === 1) {
      yaku.push({ name: "iipinmoyue", nameJa: "一筒摸月", han: 1, isYakuman: false });
    }

    // Chuupinraoyui: win by ron on 9-pin
    if (local.chuupinraoyui && hand.winType === "ron" &&
        isSuited(hand.winningTile) && (hand.winningTile as SuitedTile).suit === "pin" &&
        (hand.winningTile as SuitedTile).value === 9) {
      yaku.push({ name: "chuupinraoyui", nameJa: "九筒撈魚", han: 1, isYakuman: false });
    }

    // Uumensai: all five categories present — man, pin, sou, wind, dragon
    if (local.uumensai) {
      const hasMan = tiles.some((t) => isSuited(t) && (t as SuitedTile).suit === "man");
      const hasPin = tiles.some((t) => isSuited(t) && (t as SuitedTile).suit === "pin");
      const hasSou = tiles.some((t) => isSuited(t) && (t as SuitedTile).suit === "sou");
      const hasWind = tiles.some(isWind);
      const hasDragon = tiles.some(isDragon);
      if (hasMan && hasPin && hasSou && hasWind && hasDragon) {
        yaku.push({ name: "uumensai", nameJa: "五門斉", han: 2, isYakuman: false });
      }
    }

    // Sanrenkou: three triplets of consecutive values in the same suit
    if (local.sanrenkou) {
      outer: for (const suit of ["man", "pin", "sou"] as const) {
        const vals = allTriplets
          .filter((t) => isSuited(t[0]) && (t[0] as SuitedTile).suit === suit)
          .map((t) => (t[0] as SuitedTile).value as number)
          .sort((a, b) => a - b);
        for (let i = 0; i <= vals.length - 3; i++) {
          if (vals[i + 1] === vals[i] + 1 && vals[i + 2] === vals[i] + 2) {
            yaku.push({ name: "sanrenkou", nameJa: "三連刻", han: 2, isYakuman: false });
            break outer;
          }
        }
      }
    }

    // Iisou sanjun: same sequence three times in the same suit
    if (local.iisousanjun) {
      const seqKeyCounts = new Map<string, number>();
      for (const s of allSeqs) {
        if (!isSuited(s.tiles[0])) continue;
        const sorted = sortTiles(s.tiles).filter(isSuited) as SuitedTile[];
        const key = `${sorted[0].suit}:${sorted[0].value}`;
        seqKeyCounts.set(key, (seqKeyCounts.get(key) ?? 0) + 1);
      }
      for (const count of seqKeyCounts.values()) {
        if (count >= 3) {
          yaku.push({ name: "iisousanjun", nameJa: "一色三順", han: open ? 1 : 2, isYakuman: false });
          break;
        }
      }
    }
  }

  return yaku;
}

// ─── Yakuman ──────────────────────────────────────────────────────────────────

export function detectYakuman(
  hand: Hand,
  parsed:
    | { type: "standard"; interpretation: HandInterpretation }
    | { type: "chiitoitsu"; interp: ChiitoitsuInterpretation }
    | { type: "kokushi"; interp: KokushiInterpretation },
  rules: RulesConfig,
): Yaku[] {
  const yaku: Yaku[] = [];
  const melds = hand.melds;

  // Kokushi musou
  if (parsed.type === "kokushi") {
    yaku.push({ name: "kokushi", nameJa: "国士無双", han: 13, isYakuman: true });
    return yaku;
  }

  if (parsed.type === "chiitoitsu") {
    const chiitoi = parsed.interp;
    const local = rules.localYaku;

    // Daishichi: seven pairs using all seven different honor tiles
    if (local?.daishichi) {
      const pairTiles = chiitoi.pairs;
      const allHonors = pairTiles.every(isHonor);
      const uniqueHonors = new Set(pairTiles.map((t) => (t as HonorTile).value)).size === 7;
      if (allHonors && uniqueHonors) {
        yaku.push({ name: "daishichi", nameJa: "大七星", han: 13, isYakuman: true });
      }
    }

    // Daisharin: 22334455667788 pin (all circles chiitoitsu)
    if (local?.daisharin) {
      const pairTiles = chiitoi.pairs;
      const allPin = pairTiles.every((t) => isSuited(t) && (t as SuitedTile).suit === "pin");
      if (allPin) {
        const vals = pairTiles.map((t) => (t as SuitedTile).value).sort((a, b) => a - b);
        const expected = [2, 3, 4, 5, 6, 7, 8];
        if (vals.join() === expected.join()) {
          yaku.push({ name: "daisharin", nameJa: "大車輪", han: 13, isYakuman: true });
        }
      }
    }

    return yaku;
  }

  const interp = parsed.interpretation;
  const tiles = allTiles(interp, melds);

  // Daisangen: all three dragon triplets
  const dragonTriplets = [...interp.groups, ...melds.map((m) => ({ type: m.type === "chi" ? "sequence" : "triplet" as const, tiles: m.tiles }))]
    .filter((g) => g.type === "triplet" && isDragon(g.tiles[0]));
  if (dragonTriplets.length === 3) {
    yaku.push({ name: "daisangen", nameJa: "大三元", han: 13, isYakuman: true });
  }

  // Suuankou: four concealed triplets (tsumo only for standard; shanpon ron counts if 4 concealed)
  const allTripletGroups = [
    ...interp.groups.filter((g) => g.type === "triplet"),
    ...melds.filter((m) => m.type === "kan-closed"),
  ];
  if (allTripletGroups.length === 4 && isOpen(melds) === false) {
    // All four must be concealed; shanpon ron = still suuankou (just not tanki)
    yaku.push({ name: "suuankou", nameJa: "四暗刻", han: 13, isYakuman: true });
  }

  // Shousuushi: four winds with triplets of 3 + pair of 1
  const allGroupsAll = [
    ...interp.groups,
    ...melds.map((m) => ({ type: m.type === "chi" ? "sequence" : "triplet" as const, tiles: m.tiles })),
  ];
  const windTriplets = allGroupsAll.filter((g) => g.type === "triplet" && isWind(g.tiles[0]));
  if (windTriplets.length === 3 && isWind(interp.pair)) {
    yaku.push({ name: "shousuushi", nameJa: "小四喜", han: 13, isYakuman: true });
  }

  // Daisuushi: four wind triplets
  if (windTriplets.length === 4) {
    yaku.push({ name: "daisuushi", nameJa: "大四喜", han: 13, isYakuman: true });
  }

  // Tsuuiisou: all honors
  if (tiles.every(isHonor)) {
    yaku.push({ name: "tsuuiisou", nameJa: "字一色", han: 13, isYakuman: true });
  }

  // Ryuuiisou: all green (2s 3s 4s 6s 8s sou + hatsu)
  const greenTiles = new Set(["sou:2", "sou:3", "sou:4", "sou:6", "sou:8", "honor:hatsu"]);
  if (tiles.every((t) => greenTiles.has(`${t.suit}:${isSuited(t) ? (t as SuitedTile).value : (t as any).value}`))) {
    yaku.push({ name: "ryuuiisou", nameJa: "緑一色", han: 13, isYakuman: true });
  }

  // Chinroutou: all terminals
  if (tiles.every((t) => isSuited(t) && ((t as SuitedTile).value === 1 || (t as SuitedTile).value === 9))) {
    yaku.push({ name: "chinroutou", nameJa: "清老頭", han: 13, isYakuman: true });
  }

  // Suukantsu: four kans
  const kanCount = melds.filter(
    (m) => m.type === "kan-open" || m.type === "kan-closed" || m.type === "kan-added",
  ).length;
  if (kanCount === 4) {
    yaku.push({ name: "suukantsu", nameJa: "四槓子", han: 13, isYakuman: true });
  }

  // Suurenkou: four triplets of consecutive values in the same suit (local yakuman)
  if (rules.localYaku?.suurenkou) {
    const allTripletGroupsLocal = [
      ...interp.groups.filter((g) => g.type === "triplet"),
      ...melds
        .filter((m) => m.type === "pon" || m.type === "kan-open" || m.type === "kan-closed" || m.type === "kan-added")
        .map((m) => ({ type: "triplet" as const, tiles: m.tiles })),
    ];
    let foundSuurenkou = false;
    for (const suit of ["man", "pin", "sou"] as const) {
      const vals = allTripletGroupsLocal
        .filter((g) => isSuited(g.tiles[0]) && (g.tiles[0] as SuitedTile).suit === suit)
        .map((g) => (g.tiles[0] as SuitedTile).value as number)
        .sort((a, b) => a - b);
      for (let i = 0; i <= vals.length - 4; i++) {
        if (
          vals[i + 1] === vals[i] + 1 &&
          vals[i + 2] === vals[i] + 2 &&
          vals[i + 3] === vals[i] + 3
        ) {
          foundSuurenkou = true;
          break;
        }
      }
      if (foundSuurenkou) break;
    }
    if (foundSuurenkou) {
      yaku.push({ name: "suurenkou", nameJa: "四連刻", han: 13, isYakuman: true });
    }
  }

  // Chuurenpoutou: 1112345678999 in one suit + one more of any in that suit (closed)
  if (isOpen(melds) === false && !tiles.some(isHonor)) {
    const suits = Array.from(new Set(tiles.filter(isSuited).map((t) => (t as SuitedTile).suit)));
    if (suits.length === 1) {
      const vals = tiles.map((t) => (t as SuitedTile).value).sort((a, b) => a - b);
      const base = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9];
      // Check each tile can be the "extra"
      let isChuuren = false;
      for (let extra = 0; extra < 14; extra++) {
        const without = [...vals];
        without.splice(extra, 1);
        if (without.join() === base.join()) {
          isChuuren = true;
          break;
        }
      }
      if (isChuuren) {
        yaku.push({ name: "chuurenpoutou", nameJa: "九蓮宝燈", han: 13, isYakuman: true });
      }
    }
  }

  return yaku;
}
