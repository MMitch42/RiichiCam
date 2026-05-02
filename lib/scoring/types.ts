// ─── Tiles ────────────────────────────────────────────────────────────────────

export type Suit = "man" | "pin" | "sou";
export type SuitedValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type WindValue = "east" | "south" | "west" | "north";
export type DragonValue = "haku" | "hatsu" | "chun";
export type HonorValue = WindValue | DragonValue;

export interface SuitedTile {
  suit: Suit;
  value: SuitedValue;
  isAka?: boolean; // aka dora (red 5)
}

export interface HonorTile {
  suit: "honor";
  value: HonorValue;
}

export type Tile = SuitedTile | HonorTile;

// Dora indicator → dora resolution order (single source of truth)
// Wind: east→south→west→north→east (wraps)
export const WIND_DORA_ORDER: WindValue[] = ["east", "south", "west", "north"];
// Dragon: haku→hatsu→chun→haku (wraps)
export const DRAGON_DORA_ORDER: DragonValue[] = ["haku", "hatsu", "chun"];

// ─── Melds ────────────────────────────────────────────────────────────────────

export type MeldType =
  | "chi"         // open sequence (left player only)
  | "pon"         // open triplet
  | "kan-open"    // open quad (called from discard)
  | "kan-closed"  // closed quad (self-drawn, hand stays concealed)
  | "kan-added";  // extended pon → quad

export interface Meld {
  type: MeldType;
  tiles: [Tile, Tile, Tile] | [Tile, Tile, Tile, Tile];
  calledFrom?: "left" | "opposite" | "right"; // required for chi/pon/kan-open/kan-added
}

// ─── Hand input ───────────────────────────────────────────────────────────────

export interface Hand {
  closedTiles: Tile[];       // tiles in hand (not including winningTile for ron)
  melds: Meld[];
  winningTile: Tile;
  winType: "tsumo" | "ron";

  // Dealer derived solely from seatWind === 'east'; no separate dealer field
  seatWind: WindValue;
  roundWind: WindValue;

  doraIndicators: Tile[];
  uraDoraIndicators?: Tile[]; // only revealed with riichi

  // Situational flags
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  haitei: boolean;   // tsumo on the last draw
  houtei: boolean;   // ron on the last discard
  rinshan: boolean;  // win after kan supplemental draw
  chankan: boolean;  // win by stealing a pon→kan extension
}

// ─── Score result ─────────────────────────────────────────────────────────────

export interface Yaku {
  name: string;      // English identifier, e.g. "riichi"
  nameJa: string;    // Japanese name, e.g. "立直"
  han: number;       // closed han value; 0 for dora (counted separately)
  isYakuman: boolean;
}

export interface FuBreakdown {
  base: number;     // 30 normal, 25 chiitoitsu (chiitoitsu: all others are 0), 20 pinfu tsumo
  pairFu: number;   // 0, 2, 4, 8 depending on pair tile and rules
  meldFu: number;   // sum of all meld fu
  waitFu: number;   // 0 or 2 (kanchan/penchan/tanki = 2, ryanmen/shanpon = 0)
  tsumoFu: number;  // 2 for tsumo (0 for pinfu tsumo, 0 for ron)
  total: number;    // rounded up to nearest 10
}

export interface TsumoPayment {
  dealerPays: number;    // what the dealer pays (non-dealer tsumo)
  nonDealerPays: number; // what each non-dealer pays
}

export interface PointsBreakdown {
  total: number;
  tsumo?: TsumoPayment; // present when winType === 'tsumo'
  ron?: number;         // present when winType === 'ron'
}

// Named hand thresholds
export type HandName =
  | "mangan"       // 5 han (or 4h30f / 3h60f with kiriage), 8000 basic
  | "haneman"      // 6–7 han, 12000 basic
  | "baiman"       // 8–10 han, 16000 basic
  | "sanbaiman"    // 11–12 han, 24000 basic
  | "yakuman"      // 13+ han or yakuman, 32000 basic
  | "kazoe-yakuman"; // 13+ counted han (not yakuman by name)

export interface ScoreResult {
  valid: boolean;
  error?: string;

  yaku: Yaku[];
  totalHan: number;  // yaku han only (excludes dora)
  fu: number;        // rounded fu
  fuBreakdown: FuBreakdown;

  doraCount: number;     // indicator dora + aka dora combined (used for totalHan math)
  akaDoraCount: number;  // aka (red-five) portion of doraCount, shown separately in UI
  uraDoraCount: number;

  points: PointsBreakdown;
  handName?: HandName;
}

// ─── Rules config ─────────────────────────────────────────────────────────────

export interface RulesConfig {
  /** Open tanyao (default: true — WRC/Mahjong Soul) */
  kuitan: boolean;

  /** 4h30f or 3h60f rounds up to mangan (default: false — WRC) */
  kiriagemangan: boolean;

  /** Double yakuman for certain yakuman hands (default: false — treat as single) */
  doubleYakuman: boolean;

  /**
   * Fu value for a pair of double-wind tiles (seat === round wind).
   * WRC: 2 (each pair = 2 fu, no stacking). Mahjong Soul: 4.
   * Default: 4 (Mahjong Soul default).
   */
  doubleWindPairFu: 2 | 4;

  /**
   * Number of aka dora (red 5s) in the game set.
   * 0 = no aka dora, 3 = one per suit (standard), 4 = extra man aka.
   * Default: 3.
   */
  akaDoraCount: 0 | 3 | 4;
}

export const DEFAULT_RULES: RulesConfig = {
  kuitan: true,
  kiriagemangan: false,
  doubleYakuman: false,
  doubleWindPairFu: 4,
  akaDoraCount: 3,
};
