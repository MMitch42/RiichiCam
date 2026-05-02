import type { Tile, Meld, WindValue, RulesConfig } from "./types";
import type { HandInterpretation } from "./hand-parser";
import { isSuited, isHonor, isTerminalOrHonor, isWind, isDragon, tilesEqual } from "./tiles";
import type { FuBreakdown } from "./types";

function meldFu(meld: Meld): number {
  const isOpen =
    meld.type === "chi" ||
    meld.type === "pon" ||
    meld.type === "kan-open" ||
    meld.type === "kan-added";
  const isClosed = meld.type === "kan-closed";
  const isKan = meld.type === "kan-open" || meld.type === "kan-closed" || meld.type === "kan-added";

  const representative = meld.tiles[0];
  const isYaochuu = isTerminalOrHonor(representative);

  if (!isKan) {
    // pon/chi
    if (meld.type === "chi") return 0;
    // pon
    const base = isYaochuu ? 4 : 2;
    return isOpen ? base : base * 2;
  } else {
    // kan
    const base = isYaochuu ? 16 : 8;
    return isClosed ? base * 2 : base;
  }
}

function closedGroupFu(tiles: Tile[], groupType: "sequence" | "triplet"): number {
  if (groupType === "sequence") return 0;
  // closed triplet
  const representative = tiles[0];
  const isYaochuu = isTerminalOrHonor(representative);
  return isYaochuu ? 8 : 4;
}

function pairFu(
  tile: Tile,
  seatWind: WindValue,
  roundWind: WindValue,
  rules: RulesConfig,
): number {
  if (isDragon(tile)) return 2;
  if (isWind(tile)) {
    const isSeat = tilesEqual(tile, { suit: "honor", value: seatWind });
    const isRound = tilesEqual(tile, { suit: "honor", value: roundWind });
    if (isSeat && isRound) return rules.doubleWindPairFu;
    if (isSeat || isRound) return 2;
    return 0;
  }
  return 0;
}

export function calculateFu(
  interp: HandInterpretation,
  melds: Meld[],
  seatWind: WindValue,
  roundWind: WindValue,
  winType: "tsumo" | "ron",
  isPinfu: boolean,
  rules: RulesConfig,
): FuBreakdown {
  if (isPinfu) {
    const base = winType === "tsumo" ? 20 : 30;
    return { base, pairFu: 0, meldFu: 0, waitFu: 0, tsumoFu: 0, total: base };
  }

  // Closed ron gets the menzen +10 bonus; tsumo and open ron use base 20
  const isOpenHand = melds.some(
    (m) => m.type === "chi" || m.type === "pon" || m.type === "kan-open" || m.type === "kan-added",
  );
  const base = winType === "ron" && !isOpenHand ? 30 : 20;

  // Wait fu: tanki, kanchan, penchan = 2; ryanmen, shanpon = 0
  const waitFu =
    interp.waitType === "tanki" ||
    interp.waitType === "kanchan" ||
    interp.waitType === "penchan"
      ? 2
      : 0;

  // Tsumo fu: 2 for tsumo (not pinfu)
  const tsumoFu = winType === "tsumo" ? 2 : 0;

  // Pair fu
  const pFu = pairFu(interp.pair, seatWind, roundWind, rules);

  // Closed group fu (pairs contribute 0 here; pair fu handled separately)
  const closedMeldFu = interp.groups.reduce(
    (sum, g) => sum + (g.type === "pair" ? 0 : closedGroupFu(g.tiles, g.type as "sequence" | "triplet")),
    0,
  );

  // Open meld fu
  const openMeldFu = melds.reduce((sum, m) => sum + meldFu(m), 0);

  const totalMeldFu = closedMeldFu + openMeldFu;

  // For open hands: base is 30 if we have no concealed ron bonus
  // Actually base fu for open hand: if open, base = 30 (same), just no closed-ron bonus
  // The "closed ron bonus" doesn't exist as a separate fu; closed ron = 30 base as standard
  // Open hand (with chi) = 30 base but can't claim closed-ron 10 bonus...
  // Standard: base always 30 for standard hand, then round up. But open hand minimum is 30.
  const rawTotal = base + pFu + totalMeldFu + waitFu + tsumoFu;
  // Round up to nearest 10
  const total = Math.ceil(rawTotal / 10) * 10;

  return { base, pairFu: pFu, meldFu: totalMeldFu, waitFu, tsumoFu, total };
}

export function chiitoitsiFuBreakdown(): FuBreakdown {
  return { base: 25, pairFu: 0, meldFu: 0, waitFu: 0, tsumoFu: 0, total: 25 };
}
