import type { Tile } from "./types";
import { isHonor } from "./tiles";

const HAKU: Tile = { suit: "honor", value: "haku" };

/**
 * White-dragon (haku) fallback for a scanned hand.
 *
 * Haku is a near-blank tile face — by far the hardest class for the detector to
 * pick up — so a hand that scans a few tiles short is, in practice, almost
 * always missing haku (the app's one known weak class). When a scanned hand
 * comes up short by a single group's worth of tiles, fill the gap with haku so
 * a common real hand (a haku pair / pon / kan) scores without manual fix-up.
 *
 * Soundness guards:
 *  - Only a shortfall of 2, 3, or 4 triggers it. A shortfall of 1 is too
 *    ambiguous (any tile can drop out once); a shortfall of 5+ can't be one
 *    missing haku group (only four haku exist) and more likely means the hand
 *    was mis-framed — fabricating haku there would corrupt it.
 *  - Never produces more than 4 haku total, since only four exist in a set; if
 *    the scan already found some haku, fewer are added (and the hand may stay
 *    short, to be finished by hand) rather than inventing an impossible count.
 *
 * Pure and side-effect free. Apply it ONLY to scan-derived hand tiles, never to
 * manual edits, and never server-side where it could pollute saved training
 * data with invented labels. Added tiles are ordinary, user-editable tiles.
 *
 * @param tiles  the scanned concealed-hand tiles (winning tile excluded)
 * @param target expected concealed-hand size (13 in standard play)
 */
export function fillMissingHandWithHaku(tiles: Tile[], target = 13): Tile[] {
  const missing = target - tiles.length;
  if (missing < 2 || missing > 4) return tiles;

  const existingHaku = tiles.filter((t) => isHonor(t) && t.value === "haku").length;
  const toAdd = Math.min(missing, 4 - existingHaku);
  if (toAdd <= 0) return tiles;

  return [...tiles, ...Array.from({ length: toAdd }, () => ({ ...HAKU }))];
}
