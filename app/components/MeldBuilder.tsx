'use client';

import { useState } from 'react';
import type { Tile, Meld, MeldType } from '@/lib/scoring/types';
import TileGraphic from './TileGraphic';

interface MeldBuilderProps {
  handTiles: Tile[];
  melds: Meld[];
  onHandTilesChange: (tiles: Tile[]) => void;
  onMeldsChange: (melds: Meld[]) => void;
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

function isSequence(tiles: Tile[]): boolean {
  if (tiles.some((t) => t.suit === 'honor')) return false;
  if (new Set(tiles.map((t) => t.suit)).size > 1) return false;
  const vals = tiles.map((t) => t.value as number).sort((a, b) => a - b);
  return vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1;
}

function MeldCard({ meld, onRemove }: { meld: Meld; onRemove: () => void }) {
  const typeLabel = { chi: 'Chi', pon: 'Pon', 'kan-open': 'Kan', 'kan-closed': 'Kan', 'kan-added': 'Kan' }[meld.type];

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-sm" style={{ background: C.surfaceEl, border: `1px solid ${C.goldBorderSm}` }}>
      <div className="flex gap-1 flex-wrap">
        {meld.tiles.map((tile, i) => (
          <TileGraphic key={i} tile={tile} size="small" />
        ))}
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

export default function MeldBuilder({ handTiles, melds, onHandTilesChange, onMeldsChange }: MeldBuilderProps) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleSelect(i: number) {
    setSelectedIndices((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setError(null);
  }

  function handleCancel() {
    setSelecting(false);
    setSelectedIndices([]);
    setError(null);
  }

  function validateAndCommit(type: 'chi' | 'pon' | 'kan') {
    const selected = selectedIndices.map((i) => handTiles[i]);
    if (type === 'chi') {
      if (selectedIndices.length !== 3) { setError('Chi requires exactly 3 tiles'); return; }
      if (!isSequence(selected)) { setError('Chi requires 3 consecutive tiles of the same suit'); return; }
    } else if (type === 'pon') {
      if (selectedIndices.length !== 3) { setError('Pon requires exactly 3 tiles'); return; }
      if (!selected.every((t) => tilesEqual(t, selected[0]))) { setError('Pon requires 3 identical tiles'); return; }
    } else if (type === 'kan') {
      if (selectedIndices.length !== 4) { setError('Kan requires exactly 4 tiles'); return; }
      if (!selected.every((t) => tilesEqual(t, selected[0]))) { setError('Kan requires 4 identical tiles'); return; }
    }
    const meldType: MeldType = type === 'kan' ? 'kan-open' : type;
    const newMeld: Meld = {
      type: meldType,
      tiles: selected as [Tile, Tile, Tile] | [Tile, Tile, Tile, Tile],
    };
    onHandTilesChange(handTiles.filter((_, i) => !selectedIndices.includes(i)));
    onMeldsChange([...melds, newMeld]);
    handleCancel();
  }

  function removeMeld(idx: number) {
    const meld = melds[idx];
    onHandTilesChange([...handTiles, ...meld.tiles]);
    onMeldsChange(melds.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {melds.map((meld, i) => (
        <MeldCard key={i} meld={meld} onRemove={() => removeMeld(i)} />
      ))}

      {!selecting ? (
        <button
          onClick={() => setSelecting(true)}
          disabled={handTiles.length === 0}
          className="w-full py-2 rounded-sm text-xs font-semibold tracking-widest uppercase transition-colors disabled:opacity-40"
          style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
        >
          + Add Meld
        </button>
      ) : (
        <div className="space-y-3 rounded-sm p-3" style={{ background: C.bg, border: `1px solid ${C.goldBorderSm}` }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>
            Tap tiles to select, then choose meld type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {handTiles.map((tile, i) => {
              const sel = selectedIndices.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className="flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    border: sel ? `2px solid ${C.gold}` : `1px solid rgba(201,162,39,0.3)`,
                    borderRadius: 4,
                    boxShadow: sel ? `0 0 0 2px rgba(201,162,39,0.25)` : '0 1px 3px rgba(0,0,0,0.4)',
                    padding: 0,
                    cursor: 'pointer',
                    background: sel ? 'rgba(201,162,39,0.06)' : 'transparent',
                  }}
                >
                  <TileGraphic tile={tile} size="normal" />
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs" style={{ color: C.red }}>{error}</p>}

          <div>
            <p className="text-xs mb-2 font-mono" style={{ color: C.textSec }}>
              {selectedIndices.length} tile{selectedIndices.length !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2 flex-wrap">
              {(['chi', 'pon', 'kan'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => validateAndCommit(type)}
                  className="px-4 py-2 rounded-sm text-xs font-bold tracking-widest uppercase transition-colors"
                  style={{ background: C.gold, color: C.bg }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.goldBright)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.gold)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-sm text-xs font-medium transition-colors"
                style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
