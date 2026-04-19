'use client';

import { useState } from 'react';
import type { Tile, SuitedValue } from '@/lib/scoring/types';
import TileGraphic from './TileGraphic';

interface TileRowProps {
  tiles: Tile[];
  onChange: (tiles: Tile[]) => void;
  maxTiles?: number;
  label: string;
  usedTiles?: Tile[];
  isWinning?: boolean;
}

function tileName(tile: Tile): string {
  if (tile.suit === 'honor') {
    if (tile.value === 'haku') return 'Haku (White Dragon)';
    if (tile.value === 'hatsu') return 'Hatsu (Green Dragon)';
    if (tile.value === 'chun') return 'Chun (Red Dragon)';
    return tile.value.charAt(0).toUpperCase() + tile.value.slice(1);
  }
  const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
  return `${tile.value}${suffix}`;
}

function tilePaletteName(tile: Tile): string {
  if (tile.suit === 'honor') {
    if (tile.value === 'haku') return 'Haku · White Dragon';
    if (tile.value === 'hatsu') return 'Hatsu · Green Dragon';
    if (tile.value === 'chun') return 'Chun · Red Dragon';
    return tile.value.charAt(0).toUpperCase() + tile.value.slice(1);
  }
  return tileName(tile);
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
  { label: 'Man (Characters)', tiles: MAN_TILES },
  { label: 'Pin (Circles)', tiles: PIN_TILES },
  { label: 'Sou (Bamboo)', tiles: SOU_TILES },
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
        <span className="text-sm font-medium" style={{ color: '#f5f0e8' }}>{label}</span>
        <span className="text-sm font-medium" style={{ color: countOk ? '#8b8fa8' : '#e05252' }}>
          {tiles.length}{maxTiles !== undefined ? `/${maxTiles}` : ''}
        </span>
      </div>

      {/* Empty state: "Input Manually" CTA when palette is closed */}
      {tiles.length === 0 && !paletteOpen && !atMax && (
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ border: '1px solid #2a2d3a', color: '#8b8fa8', background: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d4a843')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2d3a')}
        >
          Input Manually
        </button>
      )}

      {/* Tile chips */}
      {tiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tiles.map((tile, i) => (
            <button
              key={i}
              onClick={() => removeTile(i)}
              aria-label={`Remove ${tileName(tile)}`}
              className="px-2.5 py-1 rounded-md text-sm font-medium flex items-center gap-1 transition-colors"
              style={{ background: '#222536', border: '1px solid #2a2d3a', color: '#f5f0e8' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d4a843')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2d3a')}
            >
              <TileGraphic tile={tile} size="normal" />
              <span style={{ color: '#8b8fa8' }}>×</span>
            </button>
          ))}
        </div>
      )}

      {/* Add / close palette link — shown when there are tiles or palette is already open */}
      {!atMax && (tiles.length > 0 || paletteOpen) && (
        <button
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="text-sm font-medium underline"
          style={{ color: '#d4a843' }}
        >
          {paletteOpen ? 'Close palette' : 'Add tile'}
        </button>
      )}

      {paletteOpen && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}>
          {PALETTE_ROWS.map(({ label: rowLabel, tiles: rowTiles }) => (
            <div key={rowLabel}>
              <p className="text-xs mb-1" style={{ color: '#8b8fa8' }}>{rowLabel}</p>
              <div className="flex flex-wrap gap-1">
                {rowTiles.map((tile, i) => (
                  <button
                    key={i}
                    onClick={() => addTile(tile)}
                    aria-label={tilePaletteName(tile)}
                    title={tilePaletteName(tile)}
                    className="px-2 py-1 rounded text-sm font-medium transition-colors"
                    style={{ background: '#222536', border: '1px solid #2a2d3a', color: '#f5f0e8' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d4a843')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2d3a')}
                  >
                    <TileGraphic tile={tile} size="small" />
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
