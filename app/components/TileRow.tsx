'use client';

import { useState } from 'react';
import type { Tile, SuitedValue } from '@/lib/scoring/types';

interface TileRowProps {
  tiles: Tile[];
  onChange: (tiles: Tile[]) => void;
  maxTiles?: number;
  label: string;
}

function tileName(tile: Tile): string {
  if (tile.suit === 'honor') {
    return tile.value.charAt(0).toUpperCase() + tile.value.slice(1);
  }
  const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
  return `${tile.value}${suffix}`;
}

const MAN_TILES: Tile[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as SuitedValue[]).map((v) => ({
  suit: 'man' as const,
  value: v,
}));
const PIN_TILES: Tile[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as SuitedValue[]).map((v) => ({
  suit: 'pin' as const,
  value: v,
}));
const SOU_TILES: Tile[] = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as SuitedValue[]).map((v) => ({
  suit: 'sou' as const,
  value: v,
}));
const HONOR_TILES: Tile[] = [
  { suit: 'honor' as const, value: 'east' as const },
  { suit: 'honor' as const, value: 'south' as const },
  { suit: 'honor' as const, value: 'west' as const },
  { suit: 'honor' as const, value: 'north' as const },
  { suit: 'honor' as const, value: 'haku' as const },
  { suit: 'honor' as const, value: 'hatsu' as const },
  { suit: 'honor' as const, value: 'chun' as const },
];

const PALETTE_ROWS = [
  { label: 'Man', tiles: MAN_TILES },
  { label: 'Pin', tiles: PIN_TILES },
  { label: 'Sou', tiles: SOU_TILES },
  { label: 'Honors', tiles: HONOR_TILES },
];

export default function TileRow({ tiles, onChange, maxTiles, label }: TileRowProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const atMax = maxTiles !== undefined && tiles.length >= maxTiles;
  const countOk = maxTiles === undefined || tiles.length === maxTiles;

  function addTile(tile: Tile) {
    if (atMax) return;
    const next = [...tiles, tile];
    onChange(next);
    if (maxTiles !== undefined && next.length >= maxTiles) {
      setPaletteOpen(false);
    }
  }

  function removeTile(index: number) {
    onChange(tiles.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-medium ${countOk ? 'text-gray-500' : 'text-red-500'}`}>
          {tiles.length}{maxTiles !== undefined ? `/${maxTiles}` : ''}
        </span>
      </div>

      {tiles.length === 0 ? (
        <div className="text-sm text-gray-400 italic">No tiles yet</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tiles.map((tile, i) => (
            <button
              key={i}
              onClick={() => removeTile(i)}
              className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 text-sm font-medium active:bg-red-100 active:text-red-700"
            >
              {tileName(tile)} ×
            </button>
          ))}
        </div>
      )}

      {!atMax && (
        <button
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="text-sm text-blue-600 font-medium underline"
        >
          {paletteOpen ? 'Close palette' : 'Add tile'}
        </button>
      )}

      {paletteOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          {PALETTE_ROWS.map(({ label: rowLabel, tiles: rowTiles }) => (
            <div key={rowLabel}>
              <p className="text-xs text-gray-400 mb-1">{rowLabel}</p>
              <div className="flex flex-wrap gap-1">
                {rowTiles.map((tile, i) => (
                  <button
                    key={i}
                    onClick={() => addTile(tile)}
                    className="px-2 py-1 rounded bg-white border border-gray-200 text-sm font-medium text-gray-700 active:bg-blue-50"
                  >
                    {tileName(tile)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
