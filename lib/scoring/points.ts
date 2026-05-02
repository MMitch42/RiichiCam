import type { HandName, PointsBreakdown } from "./types";

// Round up to nearest 100
function roundUp100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

export function handName(han: number, fu: number, isYakuman: boolean, kiriagemangan: boolean): HandName | undefined {
  if (isYakuman) return "yakuman";
  if (han >= 13) return "kazoe-yakuman";
  if (han >= 11) return "sanbaiman";
  if (han >= 8) return "baiman";
  if (han >= 6) return "haneman";
  if (han >= 5) return "mangan";
  if (basicPoints(han, fu) >= 2000) return "mangan";
  if (kiriagemangan && ((han === 4 && fu >= 30) || (han === 3 && fu >= 60))) return "mangan";
  return undefined;
}

// Basic points before dealer multiplier
// basic = fu * 2^(han+2), capped at mangan
function basicPoints(han: number, fu: number): number {
  return fu * Math.pow(2, han + 2);
}

// Base unit: the "basic points" multiplied by payment factors (×4 non-dealer ron, ×6 dealer ron, etc.)
// Mangan non-dealer ron = 2000×4 = 8000; dealer ron = 2000×6 = 12000
const MANGAN_BASIC = 2000;

function capBasic(han: number, fu: number, name: HandName | undefined): number {
  if (name === "kazoe-yakuman" || name === "yakuman") return MANGAN_BASIC * 4; // 8000
  if (name === "sanbaiman") return MANGAN_BASIC * 3;                            // 6000
  if (name === "baiman") return MANGAN_BASIC * 2;                               // 4000
  if (name === "haneman") return Math.floor(MANGAN_BASIC * 1.5);               // 3000
  if (name === "mangan") return MANGAN_BASIC;                                   // 2000
  return basicPoints(han, fu);
}

export function calculatePoints(
  han: number,
  fu: number,
  isDealer: boolean,
  winType: "tsumo" | "ron",
  isYakuman: boolean,
  kiriagemangan: boolean,
): PointsBreakdown {
  const name = handName(han, fu, isYakuman, kiriagemangan);
  const basic = capBasic(han, fu, name);

  if (winType === "ron") {
    const multiplier = isDealer ? 6 : 4;
    const total = roundUp100(basic * multiplier);
    return { total, ron: total };
  }

  // Tsumo
  if (isDealer) {
    // All three non-dealers pay dealer*2 basic
    const each = roundUp100(basic * 2);
    return { total: each * 3, tsumo: { dealerPays: each, nonDealerPays: each } };
  } else {
    // Non-dealer tsumo: dealer pays basic*2, others pay basic*1
    const dealerPays = roundUp100(basic * 2);
    const nonDealerPays = roundUp100(basic * 1);
    return { total: dealerPays + nonDealerPays * 2, tsumo: { dealerPays, nonDealerPays } };
  }
}
