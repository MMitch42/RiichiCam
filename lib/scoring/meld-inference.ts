import type { Tile, Meld } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tilesEqual(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

/** Stable string key for a sorted meld, used to deduplicate identical solutions. */
function meldKey(m: Meld): string {
  return `${m.type}:${m.tiles.map((t) => `${t.suit}${t.value}`).join(',')}`;
}

function solutionKey(melds: Meld[]): string {
  return [...melds].map(meldKey).sort().join('|');
}

/** Find indices of N tiles identical to `target` starting from index 0. */
function findNIdenticalFrom0(tiles: Tile[], n: number): number[] | null {
  const indices: number[] = [0]; // always includes index 0
  for (let i = 1; i < tiles.length && indices.length < n; i++) {
    if (tilesEqual(tiles[i], tiles[0])) indices.push(i);
  }
  return indices.length >= n ? indices.slice(0, n) : null;
}

/**
 * All valid chi sequences (3 consecutive same-suit tiles) that include tiles[0].
 * Returns arrays of indices into `tiles`.
 */
function chiSequencesContaining0(tiles: Tile[]): number[][] {
  const first = tiles[0];
  if (first.suit === 'honor') return [];
  const v = first.value as number;
  const s = first.suit;

  const results: number[][] = [];

  // The three possible sequences that include value v: [v-2,v-1,v], [v-1,v,v+1], [v,v+1,v+2]
  for (const seq of [
    [v - 2, v - 1, v],
    [v - 1, v, v + 1],
    [v, v + 1, v + 2],
  ]) {
    if (seq.some((x) => x < 1 || x > 9)) continue;
    const indices: number[] = [];
    let valid = true;
    for (const val of seq) {
      if (val === v && indices.length === 0) {
        // tiles[0] fills this slot
        indices.push(0);
      } else {
        const idx = tiles.findIndex(
          (t, i) => !indices.includes(i) && t.suit === s && (t.value as number) === val
        );
        if (idx === -1) { valid = false; break; }
        indices.push(idx);
      }
    }
    if (valid) results.push(indices);
  }

  return results;
}

// ─── Backtracking solver ───────────────────────────────────────────────────────

function backtrack(
  remaining: Tile[],
  current: Meld[],
  solutions: Meld[][],
  seen: Set<string>,
): void {
  if (remaining.length === 0) {
    const key = solutionKey(current);
    if (!seen.has(key)) {
      seen.add(key);
      solutions.push(current.map((m) => ({ ...m, tiles: [...m.tiles] as Meld['tiles'] })));
    }
    return;
  }
  if (remaining.length < 3) return; // can't complete — dead branch

  // Try kan (4 identical) — most specific, try first
  const kanIdx = findNIdenticalFrom0(remaining, 4);
  if (kanIdx) {
    const tiles = kanIdx.map((i) => remaining[i]) as [Tile, Tile, Tile, Tile];
    const next = remaining.filter((_, i) => !kanIdx.includes(i));
    current.push({ type: 'kan-open', tiles });
    backtrack(next, current, solutions, seen);
    current.pop();
  }

  // Try pon (3 identical)
  const ponIdx = findNIdenticalFrom0(remaining, 3);
  if (ponIdx) {
    const tiles = ponIdx.map((i) => remaining[i]) as [Tile, Tile, Tile];
    const next = remaining.filter((_, i) => !ponIdx.includes(i));
    current.push({ type: 'pon', tiles });
    backtrack(next, current, solutions, seen);
    current.pop();
  }

  // Try all valid chi sequences containing remaining[0]
  for (const chiIdx of chiSequencesContaining0(remaining)) {
    const tiles = chiIdx.map((i) => remaining[i]) as [Tile, Tile, Tile];
    const next = remaining.filter((_, i) => !chiIdx.includes(i));
    current.push({ type: 'chi', tiles });
    backtrack(next, current, solutions, seen);
    current.pop();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MeldInferenceResult {
  /**
   * All valid complete groupings of the detected tiles into melds.
   * - length === 1 → unambiguous, auto-populate
   * - length  >  1 → ambiguous, show disambiguation UI
   * - length === 0 → no valid grouping, surface an error
   */
  solutions: Meld[][];
}

/**
 * Given a flat list of detected tiles from the open melds section, infer all
 * valid ways to group them into chi / pon / kan melds.
 *
 * Kans are always returned as `kan-open`; the caller should prompt the user
 * to confirm open vs closed for any kan in the accepted solution.
 */
export function inferMelds(tiles: Tile[]): MeldInferenceResult {
  if (tiles.length === 0) return { solutions: [] };

  const solutions: Meld[][] = [];
  backtrack([...tiles], [], solutions, new Set());
  return { solutions };
}
