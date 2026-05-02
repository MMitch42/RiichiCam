'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Tile, Meld } from '@/lib/scoring/types';
import TileGraphic from './TileGraphic';

interface MeldBuilderProps {
  handTiles: Tile[];
  melds: Meld[];
  onHandTilesChange: (tiles: Tile[]) => void;
  onMeldsChange: (melds: Meld[]) => void;
  onActiveChange?: (active: boolean) => void;
}

const C = {
  bg:           '#080c12',
  surface:      '#0f1520',
  surfaceEl:    '#141c28',
  gold:         '#c9a227',
  goldBright:   '#e8c547',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  goldBorderXs: 'rgba(201,162,39,0.15)',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
  red:          '#cc5544',
};

function tilesEqual(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

function MeldCard({ meld, onRemove }: { meld: Meld; onRemove: () => void }) {
  const typeLabel = { chi: 'Chi', pon: 'Pon', 'kan-open': 'Kan', 'kan-closed': 'Kan', 'kan-added': 'Kan' }[meld.type];
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: C.surfaceEl, border: `1px solid ${C.goldBorderSm}` }}>
      <div className="flex gap-1 flex-wrap">
        {meld.tiles.map((tile, i) => <TileGraphic key={i} tile={tile} size="small" />)}
      </div>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0 tracking-widest uppercase" style={{ background: C.surface, color: C.gold, border: `1px solid ${C.goldBorderSm}` }}>
        {typeLabel}
      </span>
      <button onClick={onRemove} className="ml-auto flex-shrink-0 text-base leading-none transition-colors" style={{ color: C.textSec }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.textSec)}
      >
        ×
      </button>
    </div>
  );
}

// One clickable card representing a meld option (chi sequence, pon, or kan)
function MeldOptionCard({
  tiles,
  type,
  highlightIdx,
  onClick,
}: {
  tiles: Tile[];
  type: string;
  highlightIdx?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm transition-colors text-left"
      style={{ background: C.surfaceEl, border: `1px solid ${C.goldBorderSm}` }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.goldBorderSm)}
    >
      <div className="flex gap-1 items-center">
        {tiles.map((tile, i) => (
          <span
            key={i}
            style={{
              outline: i === highlightIdx ? `2px solid ${C.gold}` : undefined,
              borderRadius: 3,
              display: 'flex',
            }}
          >
            <TileGraphic tile={tile} size="small" />
          </span>
        ))}
      </div>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0 tracking-widest uppercase" style={{ background: C.surface, color: C.gold, border: `1px solid ${C.goldBorderSm}` }}>
        {type}
      </span>
    </button>
  );
}

export default function MeldBuilder({ handTiles, melds, onHandTilesChange, onMeldsChange, onActiveChange }: MeldBuilderProps) {
  const [active, setActive] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);

  const selectedTile = selectedIdx !== null ? handTiles[selectedIdx] : null;

  // All valid chi sequences containing the selected tile, as sorted index arrays
  const possibleChis = useMemo((): number[][] => {
    if (!selectedTile || selectedTile.suit === 'honor') return [];
    const v = selectedTile.value as number;
    const s = selectedTile.suit;
    const seqs = [[v - 2, v - 1, v], [v - 1, v, v + 1], [v, v + 1, v + 2]].filter(
      (seq) => seq.every((x) => x >= 1 && x <= 9)
    );
    const results: number[][] = [];
    for (const seq of seqs) {
      const usedIndices = [selectedIdx!];
      let valid = true;
      for (const val of seq) {
        if (val === v) continue; // selectedIdx covers this position
        const idx = handTiles.findIndex(
          (t, i) => !usedIndices.includes(i) && t.suit === s && t.value === val
        );
        if (idx === -1) { valid = false; break; }
        usedIndices.push(idx);
      }
      if (valid) {
        results.push(
          [...usedIndices].sort((a, b) => (handTiles[a].value as number) - (handTiles[b].value as number))
        );
      }
    }
    return results;
  }, [selectedTile, selectedIdx, handTiles]);

  // Indices for a pon (selected tile + 2 matching tiles)
  const ponIndices = useMemo((): number[] | null => {
    if (!selectedTile) return null;
    const others: number[] = [];
    for (let i = 0; i < handTiles.length && others.length < 2; i++) {
      if (i !== selectedIdx && tilesEqual(handTiles[i], selectedTile)) others.push(i);
    }
    return others.length >= 2 ? [selectedIdx!, ...others] : null;
  }, [selectedTile, selectedIdx, handTiles]);

  // Indices for a kan. Requires at least 2 other matching tiles in hand (3 total);
  // the missing 4th copy is synthesized in commit.
  const kanIndices = useMemo((): number[] | null => {
    if (!selectedTile) return null;
    const others: number[] = [];
    for (let i = 0; i < handTiles.length && others.length < 3; i++) {
      if (i !== selectedIdx && tilesEqual(handTiles[i], selectedTile)) others.push(i);
    }
    return others.length >= 2 ? [selectedIdx!, ...others.slice(0, 3)] : null;
  }, [selectedTile, selectedIdx, handTiles]);

  const noValidMelds = selectedTile !== null && possibleChis.length === 0 && !ponIndices && !kanIndices;

  function commit(type: Meld['type'], indices: number[]) {
    let tiles: Tile[] = indices.map((i) => handTiles[i]);
    // Fill missing copies when declaring kan with fewer than 4 in hand
    if (type.startsWith('kan') && tiles.length < 4) {
      const base = { suit: tiles[0].suit, value: tiles[0].value } as Tile;
      while (tiles.length < 4) tiles = [...tiles, base];
    }
    const meld: Meld = { type, tiles: tiles as Meld['tiles'] };
    onHandTilesChange(handTiles.filter((_, i) => !indices.includes(i)));
    onMeldsChange([...melds, meld]);
    setActive(false);
    setSelectedIdx(null);
  }

  function removeMeld(idx: number) {
    const meld = melds[idx];
    onHandTilesChange([...handTiles, ...meld.tiles]);
    onMeldsChange(melds.filter((_, i) => i !== idx));
  }

  function cancel() {
    setActive(false);
    setSelectedIdx(null);
  }

  return (
    <div className="space-y-2">
      {melds.map((meld, i) => (
        <MeldCard key={i} meld={meld} onRemove={() => removeMeld(i)} />
      ))}

      {!active ? (
        <button
          onClick={() => setActive(true)}
          disabled={handTiles.length === 0}
          className="w-full py-2 rounded-sm text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-40"
          style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
        >
          + Add Meld
        </button>
      ) : selectedIdx === null ? (
        // ── Stage 1: pick a tile ─────────────────────────────────────────
        <div className="space-y-3 rounded-sm p-3" style={{ background: C.bg, border: `1px solid ${C.goldBorderSm}` }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>
            Tap a tile to build a meld
          </p>
          <div className="flex flex-wrap gap-1.5">
            {handTiles.map((tile, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className="flex items-center justify-center flex-shrink-0 transition-all rounded"
                style={{
                  border: `1px solid ${C.goldBorderSm}`,
                  padding: 0,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.goldBorderSm)}
              >
                <TileGraphic tile={tile} size="normal" />
              </button>
            ))}
          </div>
          <button
            onClick={cancel}
            className="text-xs font-medium transition-colors"
            style={{ color: C.textSec }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSec)}
          >
            Cancel
          </button>
        </div>
      ) : (
        // ── Stage 2: pick meld type ──────────────────────────────────────
        <div className="space-y-2 rounded-sm p-3" style={{ background: C.bg, border: `1px solid ${C.goldBorderSm}` }}>
          <div className="flex items-center gap-2 pb-1" style={{ borderBottom: `1px solid ${C.goldBorderXs}` }}>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>Meld with</span>
            <TileGraphic tile={selectedTile!} size="small" />
            <button
              onClick={() => setSelectedIdx(null)}
              className="ml-auto text-xs font-medium transition-colors"
              style={{ color: C.textSec }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textSec)}
            >
              Change tile
            </button>
          </div>

          {/* Chi options — one card per valid sequence */}
          {possibleChis.map((indices, i) => {
            const tiles = indices.map((idx) => handTiles[idx]);
            const highlightPos = indices.indexOf(selectedIdx!);
            return (
              <MeldOptionCard
                key={i}
                tiles={tiles}
                type="Chi"
                highlightIdx={highlightPos}
                onClick={() => commit('chi', indices)}
              />
            );
          })}

          {/* Pon */}
          {ponIndices && (
            <MeldOptionCard
              tiles={ponIndices.map((idx) => handTiles[idx])}
              type="Pon"
              highlightIdx={0}
              onClick={() => commit('pon', ponIndices)}
            />
          )}

          {/* Kan */}
          {kanIndices && (() => {
            const kanTiles = kanIndices.map((idx) => handTiles[idx]);
            if (kanTiles.length === 3) {
              kanTiles.push({ suit: kanTiles[0].suit, value: kanTiles[0].value } as Tile);
            }
            return (
              <MeldOptionCard
                tiles={kanTiles}
                type="Kan"
                highlightIdx={0}
                onClick={() => commit('kan-open', kanIndices)}
              />
            );
          })()}

          {noValidMelds && (
            <p className="text-xs py-1" style={{ color: C.red }}>
              No valid melds for this tile.{' '}
              <button
                onClick={() => setSelectedIdx(null)}
                className="underline transition-colors"
                style={{ color: C.textSec }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.textSec)}
              >
                Pick another
              </button>
            </p>
          )}

          <button
            onClick={cancel}
            className="text-xs font-medium transition-colors pt-1"
            style={{ color: C.textSec }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textSec)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
