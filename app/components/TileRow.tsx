'use client';

import { useState, useEffect, useRef } from 'react';
import type { Tile, SuitedValue } from '@/lib/scoring/types';
import TileGraphic from './TileGraphic';

interface TileRowProps {
  tiles: Tile[];
  onChange: (tiles: Tile[]) => void;
  maxTiles?: number;
  minTiles?: number;
  label: string;
  usedTiles?: Tile[];
  isWinning?: boolean;
  forceOpen?: boolean;
  onForceClose?: () => void;
  forceOpenRevision?: number;
  readOnly?: boolean;
}

const C = {
  bg:           '#080c12',
  surface:      '#0f1520',
  surfaceEl:    '#141c28',
  gold:         '#c9a227',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  goldBorderXs: 'rgba(201,162,39,0.15)',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
  red:          '#cc5544',
};

function tileName(tile: Tile): string {
  if (tile.suit === 'honor') {
    if (tile.value === 'haku') return 'Haku (White Dragon)';
    if (tile.value === 'hatsu') return 'Hatsu (Green Dragon)';
    if (tile.value === 'chun') return 'Chun (Red Dragon)';
    return tile.value.charAt(0).toUpperCase() + tile.value.slice(1);
  }
  const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
  return `${tile.value}${suffix}${tile.isAka ? '★' : ''}`;
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

const MAN_TILES: Tile[] = [
  ...([1, 2, 3, 4, 5] as SuitedValue[]).map((v) => ({ suit: 'man' as const, value: v })),
  { suit: 'man' as const, value: 5 as SuitedValue, isAka: true },
  ...([6, 7, 8, 9] as SuitedValue[]).map((v) => ({ suit: 'man' as const, value: v })),
];
const PIN_TILES: Tile[] = [
  ...([1, 2, 3, 4, 5] as SuitedValue[]).map((v) => ({ suit: 'pin' as const, value: v })),
  { suit: 'pin' as const, value: 5 as SuitedValue, isAka: true },
  ...([6, 7, 8, 9] as SuitedValue[]).map((v) => ({ suit: 'pin' as const, value: v })),
];
const SOU_TILES: Tile[] = [
  ...([1, 2, 3, 4, 5] as SuitedValue[]).map((v) => ({ suit: 'sou' as const, value: v })),
  { suit: 'sou' as const, value: 5 as SuitedValue, isAka: true },
  ...([6, 7, 8, 9] as SuitedValue[]).map((v) => ({ suit: 'sou' as const, value: v })),
];
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
  { label: 'Man · Characters', tiles: MAN_TILES },
  { label: 'Pin · Circles', tiles: PIN_TILES },
  { label: 'Sou · Bamboo', tiles: SOU_TILES },
  { label: 'Honors', tiles: HONOR_TILES },
];

export default function TileRow({ tiles, onChange, maxTiles, minTiles = 0, label, usedTiles = [], forceOpen = false, onForceClose, forceOpenRevision, readOnly = false }: TileRowProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const prevForceOpenRef = useRef(forceOpen);

  // Reset manual-close override when a new force-open signal arrives (e.g. new scan)
  useEffect(() => {
    if (forceOpen && !prevForceOpenRef.current) {
      setManuallyClosed(false);
    }
    prevForceOpenRef.current = forceOpen;
  }, [forceOpen]);

  // Reset manual-close override when an external event signals it (e.g. meld added)
  useEffect(() => {
    if (forceOpenRevision !== undefined) setManuallyClosed(false);
  }, [forceOpenRevision]);

  const effectiveOpen = !readOnly && ((forceOpen && !manuallyClosed) || paletteOpen);

  const atMax = maxTiles !== undefined && tiles.length >= maxTiles;
  const countOk = tiles.length >= minTiles;

  function isAkaTile(tile: Tile): boolean {
    return tile.suit !== 'honor' && !!tile.isAka;
  }

  function tileUsedCount(tile: Tile): number {
    if (isAkaTile(tile)) {
      // Aka tiles: count only aka tiles of the same suit+value
      return usedTiles.filter((t) => t.suit === tile.suit && t.value === tile.value && t.suit !== 'honor' && !!t.isAka).length;
    }
    // Regular tiles: count all tiles of same suit+value (including aka) for the shared 4-cap
    return usedTiles.filter((t) => t.suit === tile.suit && t.value === tile.value).length;
  }

  function tileMaxCount(tile: Tile): number {
    if (isAkaTile(tile)) {
      return tile.suit === 'pin' ? 2 : 1; // pin red 5: up to 2; man/sou red 5: only 1
    }
    return 4;
  }

  function addTile(tile: Tile) {
    if (atMax || tileUsedCount(tile) >= tileMaxCount(tile)) return;
    const next = [...tiles, tile];
    onChange(next);
    if (maxTiles !== undefined && next.length >= maxTiles) {
      setPaletteOpen(false);
      setManuallyClosed(true);
      if (forceOpen) onForceClose?.();
    }
  }

  function removeTile(index: number) {
    onChange(tiles.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: countOk ? C.textSec : C.red }}>
          {tiles.length}{maxTiles !== undefined ? `/${maxTiles}` : ''}
        </span>
      </div>

      {tiles.length === 0 && !effectiveOpen && !atMax && !readOnly && (
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full py-2 rounded-sm text-xs font-medium tracking-wide transition-colors"
          style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
        >
          Input Manually
        </button>
      )}

      {tiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tiles.map((tile, i) => (
            <button
              key={i}
              onClick={() => !readOnly && removeTile(i)}
              aria-label={readOnly ? tileName(tile) : `Remove ${tileName(tile)}`}
              className="px-2 py-1 rounded text-sm font-medium flex items-center gap-1 transition-colors"
              style={{ background: C.surfaceEl, border: `1px solid ${C.goldBorderSm}`, color: C.text, cursor: readOnly ? 'default' : undefined }}
              onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.borderColor = C.gold; }}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.goldBorderSm)}
            >
              <TileGraphic tile={tile} size="normal" />
              <span style={{ color: C.textSec }}>×</span>
            </button>
          ))}
        </div>
      )}

      {!atMax && !readOnly && (tiles.length > 0 || effectiveOpen) && (
        <button
          onClick={() => {
            if (effectiveOpen) {
              setPaletteOpen(false);
              setManuallyClosed(true);
              if (forceOpen) onForceClose?.();
            } else {
              setPaletteOpen(true);
              setManuallyClosed(false);
            }
          }}
          className="text-xs font-semibold tracking-wide uppercase underline transition-colors"
          style={{ color: C.gold }}
        >
          {effectiveOpen ? 'Close palette' : 'Add tile'}
        </button>
      )}

      {effectiveOpen && (
        <div className="rounded-sm p-3 space-y-3" style={{ background: C.bg, border: `1px solid ${C.goldBorderSm}` }}>
          {PALETTE_ROWS.map(({ label: rowLabel, tiles: rowTiles }) => (
            <div key={rowLabel}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: C.textSec }}>{rowLabel}</p>
              <div className="flex flex-wrap gap-1">
                {rowTiles.map((tile, i) => {
                  const capped = tileUsedCount(tile) >= tileMaxCount(tile);
                  return (
                    <button
                      key={i}
                      onClick={() => addTile(tile)}
                      disabled={capped}
                      aria-label={tilePaletteName(tile)}
                      title={tilePaletteName(tile)}
                      className="px-1.5 py-1 rounded text-sm font-medium transition-colors"
                      style={{
                        background: C.surfaceEl,
                        border: `1px solid ${C.goldBorderSm}`,
                        color: C.text,
                        opacity: capped ? 0.3 : 1,
                      }}
                      onMouseEnter={(e) => { if (!capped) e.currentTarget.style.borderColor = C.gold; }}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.goldBorderSm)}
                    >
                      <TileGraphic tile={tile} size="small" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
