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

function tilesEqual(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

function isSequence(tiles: Tile[]): boolean {
  if (tiles.some((t) => t.suit === 'honor')) return false;
  if (new Set(tiles.map((t) => t.suit)).size > 1) return false;
  const vals = tiles.map((t) => t.value as number).sort((a, b) => a - b);
  return vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1;
}

const CALLED_FROM_OPTIONS = [
  { value: 'left' as const, label: 'Left' },
  { value: 'opposite' as const, label: 'Across' },
  { value: 'right' as const, label: 'Right' },
];

function MeldCard({ meld, onRemove }: { meld: Meld; onRemove: () => void }) {
  const typeLabel = { chi: 'Chi', pon: 'Pon', 'kan-open': 'Kan', 'kan-closed': 'Kan', 'kan-added': 'Kan' }[meld.type];
  const fromLabel = meld.calledFrom ? { left: 'Left', opposite: 'Across', right: 'Right' }[meld.calledFrom] : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#222536', border: '1px solid #2a2d3a' }}>
      <div className="flex gap-1 flex-wrap">
        {meld.tiles.map((tile, i) => (
          <TileGraphic key={i} tile={tile} size="small" />
        ))}
      </div>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#1a1d27', color: '#d4a843' }}>
        {typeLabel}
      </span>
      {fromLabel && (
        <span className="text-xs flex-shrink-0" style={{ color: '#8b8fa8' }}>
          from {fromLabel}
        </span>
      )}
      <button onClick={onRemove} className="ml-auto flex-shrink-0 text-base leading-none" style={{ color: '#8b8fa8' }}>
        ×
      </button>
    </div>
  );
}

export default function MeldBuilder({ handTiles, melds, onHandTilesChange, onMeldsChange }: MeldBuilderProps) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingMeld, setPendingMeld] = useState<{ type: MeldType; indices: number[] } | null>(null);
  const [calledFrom, setCalledFrom] = useState<'left' | 'opposite' | 'right' | null>(null);

  function toggleSelect(i: number) {
    setSelectedIndices((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setError(null);
  }

  function handleCancel() {
    setSelecting(false);
    setSelectedIndices([]);
    setError(null);
    setPendingMeld(null);
    setCalledFrom(null);
  }

  function validateAndStage(type: 'chi' | 'pon' | 'kan') {
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
    setPendingMeld({ type: meldType, indices: selectedIndices });
    setCalledFrom(type === 'chi' ? 'left' : null);
    setError(null);
  }

  function confirmMeld() {
    if (!pendingMeld) return;
    if (!calledFrom) { setError('Select who you called from'); return; }
    const selectedTiles = pendingMeld.indices.map((i) => handTiles[i]);
    const newMeld: Meld = {
      type: pendingMeld.type,
      tiles: selectedTiles as [Tile, Tile, Tile] | [Tile, Tile, Tile, Tile],
      calledFrom,
    };
    onHandTilesChange(handTiles.filter((_, i) => !pendingMeld.indices.includes(i)));
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
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{ border: '1px solid #2a2d3a', color: '#8b8fa8', background: 'transparent' }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = '#d4a843'; }}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2d3a')}
        >
          + Add Meld
        </button>
      ) : (
        <div className="space-y-3 rounded-lg p-3" style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}>
          <p className="text-xs font-medium" style={{ color: '#8b8fa8' }}>
            Tap tiles to select, then choose meld type
          </p>
          <div className="flex flex-wrap gap-1.5">
            {handTiles.map((tile, i) => {
              const sel = selectedIndices.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    border: sel ? '2px solid #d4a843' : '1px solid #d4c9a0',
                    borderRadius: 6,
                    boxShadow: sel ? '0 0 0 2px rgba(212,168,67,0.3)' : '0 1px 3px rgba(0,0,0,0.3)',
                    padding: 0,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                >
                  <TileGraphic tile={tile} size="normal" />
                </button>
              );
            })}
          </div>

          {error && <p className="text-sm" style={{ color: '#e05252' }}>{error}</p>}

          {!pendingMeld ? (
            <div>
              <p className="text-xs mb-2" style={{ color: '#8b8fa8' }}>
                {selectedIndices.length} tile{selectedIndices.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2 flex-wrap">
                {(['chi', 'pon', 'kan'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => validateAndStage(type)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold capitalize"
                    style={{ background: '#d4a843', color: '#0f1117' }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ border: '1px solid #2a2d3a', color: '#8b8fa8', background: 'transparent' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm mb-2" style={{ color: '#f5f0e8' }}>Called from:</p>
              <div className="flex gap-2 mb-3">
                {CALLED_FROM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCalledFrom(opt.value)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium"
                    style={
                      calledFrom === opt.value
                        ? { background: '#d4a843', color: '#0f1117' }
                        : { background: '#222536', color: '#8b8fa8', border: '1px solid #2a2d3a' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmMeld}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#d4a843', color: '#0f1117' }}
                >
                  Confirm
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ border: '1px solid #2a2d3a', color: '#8b8fa8', background: 'transparent' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
