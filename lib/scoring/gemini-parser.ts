import type { Tile, Meld, Suit, SuitedValue, HonorValue } from './types';

export function parseTileNotation(notation: string): Tile | null {
  if (!notation) return null;
  const s = notation.toLowerCase().trim();

  const honors: Record<string, HonorValue> = {
    east: 'east', south: 'south', west: 'west', north: 'north',
    haku: 'haku', hatsu: 'hatsu', chun: 'chun',
  };
  if (honors[s]) return { suit: 'honor', value: honors[s] };

  const m = s.match(/^([1-9])([mps])(r?)$/);
  if (!m) return null;
  const suitMap: Record<string, Suit> = { m: 'man', p: 'pin', s: 'sou' };
  return {
    suit: suitMap[m[2]],
    value: parseInt(m[1]) as SuitedValue,
    ...(m[3] ? { isAka: true } : {}),
  };
}

export function parseTileList(arr: unknown): Tile[] {
  if (!Array.isArray(arr)) return [];
  return (arr as unknown[]).flatMap((item) => {
    const t = parseTileNotation(String(item));
    return t ? [t] : [];
  });
}

export interface GeminiGuidedResult {
  hand?: Tile[];
  winningTile?: Tile;
  dora?: Tile[];
  melds?: Meld[];
}

export function parseGeminiGuided(json: Record<string, unknown>): GeminiGuidedResult {
  const result: GeminiGuidedResult = {};

  if (json.hand) result.hand = parseTileList(json.hand);
  if (json.winning_tile && json.winning_tile !== null) {
    const t = parseTileNotation(String(json.winning_tile));
    if (t) result.winningTile = t;
  }
  if (json.dora) result.dora = parseTileList(json.dora);

  if (Array.isArray(json.melds)) {
    const typeMap: Record<string, Meld['type']> = {
      chi: 'chi', pon: 'pon', kan: 'kan-open',
      'kan-open': 'kan-open', 'kan-closed': 'kan-closed', 'kan-added': 'kan-added',
    };
    result.melds = (json.melds as Array<Record<string, unknown>>).flatMap((m) => {
      const tiles = parseTileList(m.tiles);
      const type = typeMap[String(m.type ?? '').toLowerCase()];
      if (!type || tiles.length < 3) return [];
      return [{ type, tiles: tiles as Meld['tiles'] }];
    });
  }

  return result;
}

export function parseGeminiIndividual(json: Record<string, unknown>): Tile[] {
  return parseTileList(json.tiles ?? json.hand ?? []);
}
