'use client';

import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { score } from '@/lib/scoring';
import { sortTiles } from '@/lib/scoring/tiles';
import type { Hand, Meld, ScoreResult, Tile, SuitedValue, WindValue } from '@/lib/scoring/types';
import CameraCapture from './components/CameraCapture';
import TileRow from './components/TileRow';
import TileGraphic from './components/TileGraphic';
import MeldBuilder from './components/MeldBuilder';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#080c12',
  surface:      '#0f1520',
  surfaceEl:    '#141c28',
  gold:         '#c9a227',
  goldBright:   '#e8c547',
  goldMuted:    'rgba(201,162,39,0.25)',
  goldBorder:   'rgba(201,162,39,0.35)',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  goldBorderXs: 'rgba(201,162,39,0.15)',
  goldHover:    'rgba(201,162,39,0.08)',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
  textDim:      '#4a4438',
  red:          '#a83228',
  redText:      '#cc5544',
};

// ─── Reusable UI primitives ───────────────────────────────────────────────────

function Toggle({
  label,
  sub,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`py-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: C.text }}>{label}</span>
        <button
          onClick={() => onChange(!value)}
          aria-pressed={value}
          className="flex-shrink-0 px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-sm transition-colors"
          style={
            value
              ? { background: C.goldMuted, color: C.gold, border: `1px solid ${C.gold}` }
              : { background: 'transparent', color: C.textSec, border: `1px solid ${C.goldBorderSm}` }
          }
        >
          {value ? 'ON' : 'OFF'}
        </button>
      </div>
      {sub && <p className="text-xs mt-1 pr-16" style={{ color: C.textSec }}>{sub}</p>}
    </div>
  );
}

function Stepper({
  label,
  sub,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  sub?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: C.text }}>{label}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-8 h-8 text-lg font-medium flex items-center justify-center rounded-sm disabled:opacity-40 transition-colors"
            style={{ background: C.surfaceEl, color: C.text, border: `1px solid ${C.goldBorderSm}` }}
          >
            −
          </button>
          <span className="w-5 text-center text-base font-semibold tabular-nums" style={{ color: C.text }}>{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-8 h-8 text-lg font-medium flex items-center justify-center rounded-sm disabled:opacity-40 transition-colors"
            style={{ background: C.surfaceEl, color: C.text, border: `1px solid ${C.goldBorderSm}` }}
          >
            +
          </button>
        </div>
      </div>
      {sub && <p className="text-xs mt-1" style={{ color: C.textSec }}>{sub}</p>}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-3">
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: C.textSec }}>{label}</p>
      <div className="flex rounded-sm overflow-hidden" style={{ border: `1px solid ${C.goldBorderSm}`, background: C.surfaceEl }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 py-2.5 text-sm font-semibold tracking-wide transition-colors"
            style={
              value === opt.value
                ? { background: C.gold, color: C.bg }
                : { background: 'transparent', color: C.textSec }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${C.goldBorderXs}` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.gold }}>{label}</span>
        <span className="text-xs" style={{ color: C.gold }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="pb-3 space-y-0 rounded-sm px-3 py-1 mb-2" style={{ background: C.surface }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Winning tile palette ─────────────────────────────────────────────────────

const ALL_TILES: Tile[] = [
  ...[1,2,3,4,5,6,7,8,9].map(v => ({ suit: 'man' as const, value: v as SuitedValue })),
  { suit: 'man' as const, value: 5 as SuitedValue, isAka: true },
  ...[1,2,3,4,5,6,7,8,9].map(v => ({ suit: 'pin' as const, value: v as SuitedValue })),
  { suit: 'pin' as const, value: 5 as SuitedValue, isAka: true },
  ...[1,2,3,4,5,6,7,8,9].map(v => ({ suit: 'sou' as const, value: v as SuitedValue })),
  { suit: 'sou' as const, value: 5 as SuitedValue, isAka: true },
  { suit: 'honor' as const, value: 'east'  as const },
  { suit: 'honor' as const, value: 'south' as const },
  { suit: 'honor' as const, value: 'west'  as const },
  { suit: 'honor' as const, value: 'north' as const },
  { suit: 'honor' as const, value: 'haku'  as const },
  { suit: 'honor' as const, value: 'hatsu' as const },
  { suit: 'honor' as const, value: 'chun'  as const },
];

const WINNING_PALETTE_ROWS = [
  { label: 'Man · Characters', tiles: ALL_TILES.filter(t => t.suit === 'man') },
  { label: 'Pin · Circles',    tiles: ALL_TILES.filter(t => t.suit === 'pin') },
  { label: 'Sou · Bamboo',     tiles: ALL_TILES.filter(t => t.suit === 'sou') },
  { label: 'Honors',           tiles: ALL_TILES.filter(t => t.suit === 'honor') },
];

function tileMatches(a: Tile, b: Tile) {
  return a.suit === b.suit && a.value === b.value;
}

function tileLabel(tile: Tile): string {
  if (tile.suit === 'honor') {
    if (tile.value === 'haku') return 'Haku (White Dragon)';
    if (tile.value === 'hatsu') return 'Hatsu (Green Dragon)';
    if (tile.value === 'chun') return 'Chun (Red Dragon)';
    return tile.value.charAt(0).toUpperCase() + tile.value.slice(1);
  }
  const suffix = tile.suit === 'man' ? 'm' : tile.suit === 'pin' ? 'p' : 's';
  return `${tile.value}${suffix}`;
}

// ─── Result panel ─────────────────────────────────────────────────────────────

const YAKU_INFO: Record<string, { en: string; desc: string }> = {
  'riichi':           { en: 'Riichi',                    desc: 'Declare a closed tenpai hand by paying 1000 points. Closed hand only.' },
  'double-riichi':    { en: 'Double Riichi',             desc: 'Riichi declared on your very first discard before anyone else has drawn. Closed hand only.' },
  'ippatsu':          { en: 'One Shot',                  desc: 'Win within one full round after declaring Riichi, before any calls are made.' },
  'tsumo':            { en: 'Self Draw',                 desc: 'Win by drawing your own winning tile. Closed hand only.' },
  'tanyao':           { en: 'All Simples',               desc: 'All tiles are numbered 2 through 8. No 1s, 9s, or honor tiles allowed.' },
  'pinfu':            { en: 'All Sequences',             desc: 'All four groups are sequences, the pair is not a scoring honor tile, and the wait is two-sided. Closed hand only. Always 0 fu.' },
  'iipeiko':          { en: 'Pure Double Sequence',      desc: 'Two identical sequences in the same suit. Closed hand only.' },
  'ryanpeiko':        { en: 'Twice Pure Double',         desc: 'Two separate pairs of identical sequences. Worth 3 han. Closed hand only.' },
  'sanshoku-doujun':  { en: 'Three-Color Straight',      desc: 'The same three-tile sequence in all three suits. Worth 1 han open, 2 han closed.' },
  'sanshoku-doukou':  { en: 'Three-Color Triplet',       desc: 'The same number as a triplet in all three suits.' },
  'ittsu':            { en: 'Pure Straight',             desc: 'Sequences 1-2-3, 4-5-6, and 7-8-9 all in the same suit. Worth 1 han open, 2 han closed.' },
  'chanta':           { en: 'Outside Hand',              desc: 'Every group and the pair contain a terminal (1 or 9) or honor tile. Worth 1 han open, 2 han closed.' },
  'junchan':          { en: 'Terminal in Each Group',    desc: 'Every group and the pair contain a terminal (1 or 9). No honor tiles. Worth 2 han open, 3 han closed.' },
  'toitoi':           { en: 'All Triplets',              desc: 'All four groups are triplets or quads. No sequences.' },
  'sanankou':         { en: 'Three Concealed Triplets',  desc: 'Three of your four groups are triplets formed without calling on those specific tiles.' },
  'sankantsu':        { en: 'Three Quads',               desc: 'Three of your groups are quads.' },
  'honitsu':          { en: 'Half Flush',                desc: 'All tiles are from one suit, plus honor tiles. Worth 2 han open, 3 han closed.' },
  'chinitsu':         { en: 'Full Flush',                desc: 'All tiles are from a single suit. No honor tiles. Worth 5 han open, 6 han closed.' },
  'chiitoitsu':       { en: 'Seven Pairs',               desc: 'Seven unique pairs. No two pairs can be the same tile. Closed hand only. Always 25 fu.' },
  'rinshan':          { en: 'Dead Wall Draw',            desc: 'Win by drawing the replacement tile after declaring a quad.' },
  'chankan':          { en: 'Robbing the Quad',          desc: 'Win by taking a tile someone adds to an existing triplet to make a quad.' },
  'haitei':           { en: 'Last Tile Draw',            desc: 'Win by drawing the very last tile in the wall.' },
  'houtei':           { en: 'Last Tile Discard',         desc: 'Win by claiming the very last discard of the round.' },
  'yakuhai':          { en: 'Honor Triplet',             desc: 'A triplet of dragons, or a triplet of the wind matching your seat or the round wind.' },
  'shousangen':       { en: 'Little Three Dragons',      desc: 'Triplets of two dragon tiles and a pair of the third dragon.' },
  'kokushi':          { en: 'Thirteen Orphans',          desc: 'One each of every terminal and honor tile, plus one duplicate. Closed hand only.' },
  'suuankou':         { en: 'Four Concealed Triplets',   desc: 'All four groups are triplets formed without calling. Closed hand only.' },
  'daisangen':        { en: 'Big Three Dragons',         desc: 'Triplets of all three dragon tiles.' },
  'shousuushi':       { en: 'Little Four Winds',         desc: 'Triplets of three wind tiles and a pair of the fourth wind.' },
  'daisuushi':        { en: 'Big Four Winds',            desc: 'Triplets of all four wind tiles.' },
  'tsuuiisou':        { en: 'All Honors',                desc: 'Every tile is an honor tile. No suited tiles at all.' },
  'ryuuiisou':        { en: 'All Green',                 desc: 'All tiles are from: 2, 3, 4, 6, 8 of bamboo, and green dragon.' },
  'chinroutou':       { en: 'All Terminals',             desc: 'Every tile is a 1 or 9. No middle tiles, no honor tiles.' },
  'chuurenpoutou':    { en: 'Nine Gates',                desc: '1-1-1-2-3-4-5-6-7-8-9-9-9 in one suit, plus any matching tile. Closed hand only.' },
  'suukantsu':        { en: 'Four Quads',                desc: 'All four groups are quads.' },
  'tenhou':           { en: 'Heavenly Hand',             desc: 'Dealer wins on their starting hand before the first discard.' },
  'chiihou':          { en: 'Earthly Hand',              desc: 'Non-dealer wins on their very first draw before anyone has made a call.' },
};

const HAND_NAME_LABELS: Record<string, string> = {
  mangan: 'MANGAN',
  haneman: 'HANEMAN',
  baiman: 'BAIMAN',
  sanbaiman: 'SANBAIMAN',
  yakuman: 'YAKUMAN',
  'kazoe-yakuman': 'KAZOE YAKUMAN',
};

function ResultPanel({
  result,
  winType,
  seatWind,
}: {
  result: ScoreResult;
  winType: 'tsumo' | 'ron';
  seatWind: WindValue;
}) {
  const [fuOpen, setFuOpen] = useState(false);
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  if (!result.valid) {
    return (
      <div className="rounded-sm p-4" style={{ background: C.surface, border: `1px solid rgba(168,50,40,0.4)`, borderLeft: `2px solid ${C.red}` }}>
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: C.redText }}>Invalid hand</p>
        <p className="text-xs mt-1" style={{ color: C.redText }}>{result.error}</p>
      </div>
    );
  }

  const sortedYaku = [...result.yaku].sort((a, b) => b.han - a.han);
  const totalDora = result.doraCount + result.uraDoraCount;
  const grandTotal = result.totalHan + totalDora;
  const isDealer = seatWind === 'east';

  return (
    <div className="rounded-sm overflow-hidden" style={{ background: C.bg, border: `1px solid ${C.goldBorder}`, borderTop: `2px solid ${C.gold}` }}>
      {/* Points header */}
      <div className="px-5 py-5" style={{ background: `linear-gradient(to bottom, rgba(201,162,39,0.08), transparent)`, borderBottom: `1px solid ${C.goldBorderXs}` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="leading-none font-bold tabular-nums" style={{ fontSize: '3.5rem', color: C.goldBright, fontVariantNumeric: 'tabular-nums' }}>
              {result.points.total.toLocaleString()}
            </p>
            <p className="text-xs mt-1 font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>points</p>
          </div>
          {result.handName && (
            <span
              className="mt-2 shrink-0 px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-widest"
              style={{ background: C.gold, color: C.bg }}
            >
              {HAND_NAME_LABELS[result.handName] ?? result.handName.toUpperCase()}
            </span>
          )}
        </div>
        {winType === 'tsumo' && result.points.tsumo && (
          isDealer ? (
            <p className="text-sm mt-4 font-mono" style={{ color: C.text }}>
              Each player pays{' '}
              <span className="font-semibold" style={{ color: C.gold }}>{result.points.tsumo.nonDealerPays.toLocaleString()}</span>
            </p>
          ) : (
            <p className="text-sm mt-4 font-mono" style={{ color: C.text }}>
              Dealer{' '}
              <span className="font-semibold" style={{ color: C.gold }}>{result.points.tsumo.dealerPays.toLocaleString()}</span>
              <span style={{ color: C.textSec }}> · </span>Each non-dealer{' '}
              <span className="font-semibold" style={{ color: C.gold }}>{result.points.tsumo.nonDealerPays.toLocaleString()}</span>
            </p>
          )
        )}
        {winType === 'ron' && result.points.ron !== undefined && (
          <p className="text-sm mt-4 font-mono" style={{ color: C.text }}>
            Opponent pays{' '}
            <span className="font-semibold" style={{ color: C.gold }}>{result.points.ron.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Yaku list */}
      <div className="px-5 py-2" style={{ borderBottom: `1px solid ${C.goldBorderXs}` }}>
        {sortedYaku.map((y, i) => {
          const info = YAKU_INFO[y.name];
          const isOpen = openTooltip === y.name;
          return (
            <div
              key={i}
              style={{ borderBottom: i < sortedYaku.length - 1 || totalDora > 0 ? `1px solid ${C.goldBorderXs}` : 'none' }}
            >
              <div className="flex items-center justify-between py-2.5 font-mono text-sm gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span style={{ color: C.text }} className="truncate">
                    {info ? (
                      <>
                        <span style={{ color: C.text }}>
                          {y.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                        <span style={{ color: C.textSec }}> · </span>
                        <span style={{ color: C.text }}>{info.en}</span>
                      </>
                    ) : y.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                  {info && (
                    <button
                      onClick={() => setOpenTooltip(isOpen ? null : y.name)}
                      className="flex-shrink-0 w-4 h-4 rounded-sm text-xs font-bold flex items-center justify-center transition-colors"
                      style={{
                        background: isOpen ? C.goldMuted : 'transparent',
                        color: isOpen ? C.gold : C.textSec,
                        border: `1px solid ${isOpen ? C.gold : C.goldBorderSm}`,
                        lineHeight: 1,
                      }}
                    >
                      ?
                    </button>
                  )}
                </div>
                <span className="font-semibold flex-shrink-0" style={{ color: C.gold }}>
                  {y.isYakuman ? 'yakuman' : `${y.han} han`}
                </span>
              </div>
              {isOpen && info && (
                <div
                  className="text-xs pb-2.5 leading-relaxed"
                  style={{ color: C.textSec }}
                >
                  {info.desc}
                </div>
              )}
            </div>
          );
        })}
        {totalDora > 0 && (
          <div className="flex justify-between py-2.5 font-mono text-sm">
            <span style={{ color: C.text }}>
              Dora{result.uraDoraCount > 0 && ` (${result.doraCount} + ${result.uraDoraCount} ura)`}
            </span>
            <span className="font-semibold" style={{ color: C.gold }}>{totalDora} han</span>
          </div>
        )}
      </div>

      {/* Han + fu summary */}
      <div className="px-5 py-2.5" style={{ borderBottom: `1px solid ${C.goldBorderXs}` }}>
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>
          {grandTotal} han &nbsp;/&nbsp; {result.fu} fu
        </p>
      </div>

      {/* Fu breakdown */}
      <div>
        <button
          onClick={() => setFuOpen(!fuOpen)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.gold }}>Fu breakdown</span>
          <span className="text-xs" style={{ color: C.gold }}>{fuOpen ? '▴' : '▾'}</span>
        </button>
        {fuOpen && (
          <div className="px-5 pb-4 space-y-1">
            {[
              { label: 'Base fu', val: result.fuBreakdown.base },
              { label: 'Meld fu', val: result.fuBreakdown.meldFu },
              { label: 'Pair fu', val: result.fuBreakdown.pairFu },
              { label: 'Wait fu', val: result.fuBreakdown.waitFu },
              { label: 'Tsumo fu', val: result.fuBreakdown.tsumoFu },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between text-sm font-mono">
                <span style={{ color: C.textSec }}>{label}</span>
                <span style={{ color: C.text }}>{val}</span>
              </div>
            ))}
            <div
              className="flex justify-between text-sm font-mono font-semibold pt-2 mt-1"
              style={{ borderTop: `1px solid ${C.goldBorderXs}`, color: C.text }}
            >
              <span>Total → rounded</span>
              <span>{result.fuBreakdown.total}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // ── Camera / tile state ───────────────────────────────────────────────────
  const [handTiles, setHandTiles] = useState<Tile[]>([]);
  const [winningTile, setWinningTile] = useState<Tile | null>(null);
  const [doraIndicatorTiles, setDoraIndicatorTiles] = useState<Tile[]>([]);
  const [melds, setMelds] = useState<Meld[]>([]);
  const [isDetectingHand, setIsDetectingHand] = useState(false);
  const [isDetectingDora, setIsDetectingDora] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [handScanned, setHandScanned] = useState(false);
  const [doraScanned, setDoraScanned] = useState(false);
  const [handImageUrl, setHandImageUrl] = useState<string | null>(null);
  const [doraImageUrl, setDoraImageUrl] = useState<string | null>(null);

  // ── Win type ──────────────────────────────────────────────────────────────
  const [winType, setWinType] = useState<'tsumo' | 'ron'>('tsumo');

  // ── Dealer / seat wind (synced) ───────────────────────────────────────────
  const [dealer, setDealer] = useState(false);
  const [seatWind, setSeatWind] = useState<WindValue>('south');

  // ── Round wind ────────────────────────────────────────────────────────────
  const [roundWind, setRoundWind] = useState<WindValue>('east');

  // ── Riichi flags ──────────────────────────────────────────────────────────
  const [riichi, setRiichi] = useState(false);
  const [doubleRiichi, setDoubleRiichi] = useState(false);
  const [ippatsu, setIppatsu] = useState(false);
  const [uraDora, setUraDora] = useState(0);

  // ── Special conditions ────────────────────────────────────────────────────
  const [haitei, setHaitei] = useState(false);
  const [houtei, setHoutei] = useState(false);
  const [rinshan, setRinshan] = useState(false);
  const [chankan, setChankan] = useState(false);

  // ── Result ────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<ScoreResult | null>(null);

  // ── Sync helpers ──────────────────────────────────────────────────────────
  function handleDealer(on: boolean) {
    setDealer(on);
    setSeatWind(on ? 'east' : 'south');
  }

  function handleSeatWind(w: WindValue) {
    setSeatWind(w);
    setDealer(w === 'east');
  }

  function handleDoubleRiichi(on: boolean) {
    setDoubleRiichi(on);
    if (on) setRiichi(true);
  }

  function handleWinType(wt: 'tsumo' | 'ron') {
    setWinType(wt);
    if (wt === 'ron') {
      setHaitei(false);
      setRinshan(false);
    } else {
      setHoutei(false);
      setChankan(false);
    }
  }

  // ── Detection handlers ────────────────────────────────────────────────────
  function handleClear() {
    setHandTiles([]);
    setWinningTile(null);
    setDoraIndicatorTiles([]);
    setMelds([]);
    setResult(null);
    setHandScanned(false);
    setDoraScanned(false);
    setHandImageUrl(null);
    setDoraImageUrl(null);
    setDetectError(null);
  }

  async function handleHandCapture(base64: string) {
    setIsDetectingHand(true);
    setDetectError(null);
    setHandScanned(true);
    setHandImageUrl(`data:image/jpeg;base64,${base64}`);
    setResult(null);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (data.error) {
        setDetectError(data.error);
        return;
      }
      const tiles: Tile[] = data.tiles;
      setHandTiles(sortTiles(tiles.slice(0, 13)));
      if (tiles.length >= 14) setWinningTile(tiles[13]);
    } catch {
      setDetectError('Detection failed. Check your connection and try again.');
    } finally {
      setIsDetectingHand(false);
    }
  }

  async function handleDoraCapture(base64: string) {
    setIsDetectingDora(true);
    setDetectError(null);
    setDoraScanned(true);
    setDoraImageUrl(`data:image/jpeg;base64,${base64}`);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (data.error) {
        setDetectError(data.error);
        return;
      }
      setDoraIndicatorTiles(sortTiles(data.tiles.slice(0, 4)));
    } catch {
      setDetectError('Detection failed. Check your connection and try again.');
    } finally {
      setIsDetectingDora(false);
    }
  }

  // ── Build hand for scoring ────────────────────────────────────────────────
  function buildHand(): Hand | null {
    const meldTileCount = melds.reduce((s, m) => s + m.tiles.length, 0);
    if (handTiles.length + meldTileCount !== 13 || !winningTile) return null;
    return {
      closedTiles: handTiles,
      winningTile,
      melds,
      doraIndicators: doraIndicatorTiles,
      winType,
      seatWind,
      roundWind,
      riichi: riichi || doubleRiichi,
      doubleRiichi,
      ippatsu: (riichi || doubleRiichi) && ippatsu,
      haitei: winType === 'tsumo' && haitei,
      houtei: winType === 'ron' && houtei,
      rinshan: winType === 'tsumo' && rinshan,
      chankan: winType === 'ron' && chankan,
      uraDoraIndicators: riichi
        ? (Array(uraDora).fill({ suit: 'man' as const, value: 1 }) as Tile[])
        : undefined,
    };
  }

  function handleScore() {
    const hand = buildHand();
    if (!hand) return;
    setResult(score(hand));
  }

  const meldTileCount = melds.reduce((s, m) => s + m.tiles.length, 0);

  const tenpaiWaits = useMemo<Tile[]>(() => {
    const meldCount = melds.reduce((s, m) => s + m.tiles.length, 0);
    if (handTiles.length + meldCount !== 13) return [];
    return ALL_TILES.filter(candidate => {
      try {
        const result = score({
          closedTiles: handTiles,
          melds,
          winningTile: candidate,
          winType,
          seatWind,
          roundWind,
          doraIndicators: doraIndicatorTiles,
          riichi,
          doubleRiichi,
          ippatsu,
          haitei,
          houtei,
          rinshan,
          chankan,
        });
        return result.valid;
      } catch {
        return false;
      }
    });
  }, [handTiles, melds, winType, seatWind, roundWind, doraIndicatorTiles, riichi, doubleRiichi, ippatsu, haitei, houtei, rinshan, chankan]);

  const canScore = handTiles.length + meldTileCount === 13 && winningTile !== null;
  const usedTiles: Tile[] = [
    ...handTiles,
    ...(winningTile ? [winningTile] : []),
    ...melds.flatMap((m) => [...m.tiles]),
  ];
  const isRiichi = riichi || doubleRiichi;
  const showHandRows = handScanned || handTiles.length > 0 || winningTile !== null || melds.length > 0;
  const showDoraRow = doraScanned || doraIndicatorTiles.length > 0;

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <div className="max-w-md mx-auto px-4 py-8 space-y-3">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.goldBorder}` }} className="rounded-sm overflow-hidden -mx-4 px-4 py-4 mb-2">
          <div className="flex items-center gap-4">
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-sm"
              style={{ width: 44, height: 44, background: C.surfaceEl, border: `1px solid ${C.goldBorderSm}` }}
            >
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="3" width="24" height="26" rx="2" fill={C.surfaceEl} stroke={C.gold} strokeWidth="1.5"/>
                <text x="16" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill={C.gold} fontFamily="serif">中</text>
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-[0.12em] uppercase leading-tight" style={{ color: C.gold }}>RiichiCam</h1>
              <p className="text-xs mt-0.5 tracking-widest uppercase" style={{ color: C.textSec }}>Riichi mahjong scorer</p>
            </div>
          </div>
        </div>

        {/* ── Hand scan ─────────────────────────────────────────────────── */}
        <section
          className="rounded-sm p-4 space-y-4"
          style={{ background: C.surface, border: `1px solid ${C.goldBorderSm}` }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>Hand</p>
          <CameraCapture
            label="Scan Hand"
            onCapture={handleHandCapture}
            isLoading={isDetectingHand}
          />
          {handImageUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={handImageUrl}
                alt="Scanned hand"
                className="rounded-sm object-cover flex-shrink-0"
                style={{ height: 64, width: 'auto', maxWidth: 120, border: `1px solid ${C.goldBorderSm}` }}
              />
              <p className="text-xs" style={{ color: C.textSec }}>Scan preview — tap tiles below to correct any misdetections.</p>
            </div>
          )}
          {showHandRows ? (
            <div className="space-y-4">
              <TileRow
                label="Hand tiles"
                tiles={handTiles}
                onChange={(tiles) => setHandTiles(sortTiles(tiles))}
                maxTiles={13 - meldTileCount}
                usedTiles={usedTiles}
                forceOpen={handScanned && handTiles.length + meldTileCount < 13}
              />

              {(handScanned || handTiles.length > 0) && (
                <MeldBuilder
                  handTiles={handTiles}
                  melds={melds}
                  onHandTilesChange={setHandTiles}
                  onMeldsChange={setMelds}
                />
              )}

              {handTiles.length + meldTileCount === 13 && (
                <div
                  className="-mx-4 px-4 pb-4 pt-4"
                  style={{ background: C.surfaceEl, borderTop: `1px solid ${C.goldBorderXs}` }}
                >
                  {tenpaiWaits.length === 0 ? (
                    <div style={{ border: `1px solid ${C.goldBorderSm}`, borderRadius: 2, padding: '10px 14px' }}>
                      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: C.textSec }}>
                        Winning Tile
                      </p>
                      <p className="text-xs" style={{ color: C.red }}>
                        Hand is not in tenpai — remove and re-add tiles to fix misdetections.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: C.textSec }}>
                        Winning Tile
                      </p>
                      <div className="rounded-sm p-3 space-y-3" style={{ background: C.bg, border: `1px solid ${C.goldBorderSm}` }}>
                        {WINNING_PALETTE_ROWS.map(({ label: rowLabel, tiles: rowTiles }) => (
                          <div key={rowLabel}>
                            <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: C.textSec }}>{rowLabel}</p>
                            <div className="flex flex-wrap gap-1">
                              {rowTiles.map((tile, i) => {
                                const isWait = tenpaiWaits.some(w => tileMatches(w, tile));
                                const isSelected = winningTile !== null && tileMatches(winningTile, tile);
                                return (
                                  <button
                                    key={i}
                                    onClick={() => setWinningTile(tile)}
                                    aria-label={tileLabel(tile)}
                                    title={tileLabel(tile)}
                                    className="px-1.5 py-1 rounded text-sm font-medium transition-all"
                                    style={{
                                      background: isSelected ? 'rgba(201,162,39,0.2)' : C.surfaceEl,
                                      border: `1px solid ${isSelected || isWait ? C.gold : C.goldBorderSm}`,
                                      opacity: isSelected || isWait ? 1 : 0.3,
                                      transform: isSelected ? 'scale(1.15)' : undefined,
                                    }}
                                    onMouseEnter={(e) => {
                                      if (isWait && !isSelected) e.currentTarget.style.boxShadow = `0 0 6px ${C.gold}`;
                                    }}
                                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                                  >
                                    <TileGraphic tile={tile} size="small" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {winningTile && (
                        <div className="mt-3 flex items-center gap-2">
                          <TileGraphic tile={winningTile} size="normal" />
                          <span className="text-xs" style={{ color: C.textSec }}>{tileLabel(winningTile)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center" style={{ color: C.textSec }}>
                Tap &lsquo;Scan Hand&rsquo; to detect tiles automatically
              </p>
              <button
                onClick={() => setHandScanned(true)}
                className="w-full py-2.5 rounded-sm text-sm font-medium tracking-wide transition-colors"
                style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
              >
                Input Manually
              </button>
            </div>
          )}
        </section>

        {/* ── Dora scan ─────────────────────────────────────────────────── */}
        <section
          className="rounded-sm p-4 space-y-4"
          style={{ background: C.surface, border: `1px solid ${C.goldBorderSm}` }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: C.textSec }}>Dora</p>
          <CameraCapture
            label="Scan Dora"
            onCapture={handleDoraCapture}
            isLoading={isDetectingDora}
          />
          {doraImageUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doraImageUrl}
                alt="Scanned dora"
                className="rounded-sm object-cover flex-shrink-0"
                style={{ height: 64, width: 'auto', maxWidth: 120, border: `1px solid ${C.goldBorderSm}` }}
              />
              <p className="text-xs" style={{ color: C.textSec }}>Scan preview — correct misdetections below.</p>
            </div>
          )}
          {showDoraRow ? (
            <TileRow
              label="Dora indicators"
              tiles={doraIndicatorTiles}
              onChange={setDoraIndicatorTiles}
              maxTiles={4}
              usedTiles={usedTiles}
            />
          ) : (
            <button
              onClick={() => setDoraScanned(true)}
              className="w-full py-2 rounded-sm text-xs font-medium tracking-wide transition-colors"
              style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
            >
              Input Manually
            </button>
          )}
        </section>

        {/* ── Detection error ──────────────────────────────────────────── */}
        {detectError && (
          <p className="text-sm font-medium px-1" style={{ color: C.redText }}>{detectError}</p>
        )}

        {/* ── Conditions ────────────────────────────────────────────────── */}
        <section
          className="rounded-sm px-4"
          style={{ background: C.surface, border: `1px solid ${C.goldBorderSm}` }}
        >
          {/* Win type */}
          <div className="py-3">
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: C.textSec }}>Win type</p>
            <div
              className="flex rounded-sm overflow-hidden"
              style={{ border: `1px solid ${C.goldBorderSm}`, background: C.surfaceEl }}
            >
              {(['tsumo', 'ron'] as const).map((wt) => (
                <button
                  key={wt}
                  onClick={() => handleWinType(wt)}
                  className="flex-1 py-3 text-sm font-semibold tracking-widest uppercase transition-colors"
                  style={
                    winType === wt
                      ? { background: C.gold, color: C.bg }
                      : { background: 'transparent', color: C.textSec }
                  }
                >
                  {wt === 'tsumo' ? 'Tsumo' : 'Ron'}
                </button>
              ))}
            </div>
          </div>

          {/* Dealer */}
          <div style={{ borderTop: `1px solid ${C.goldBorderXs}` }}>
            <Toggle
              label="I am dealer (East seat)"
              value={dealer}
              onChange={handleDealer}
            />
          </div>

          {/* Riichi */}
          <div style={{ borderTop: `1px solid ${C.goldBorderXs}` }}>
            <Toggle
              label="Riichi"
              sub="Declare before winning with a closed hand."
              value={riichi}
              onChange={(v) => {
                setRiichi(v);
                if (!v) {
                  setDoubleRiichi(false);
                  setIppatsu(false);
                  setUraDora(0);
                }
              }}
            />
          </div>

          {/* Riichi sub-options */}
          {isRiichi && (
            <>
              <div className="pl-4 ml-0.5" style={{ borderLeft: `2px solid ${C.gold}`, borderTop: `1px solid ${C.goldBorderXs}` }}>
                <Toggle
                  label="Ippatsu"
                  sub="Won within one round of discards after riichi."
                  value={ippatsu}
                  onChange={setIppatsu}
                />
              </div>
              <div className="pl-4 ml-0.5" style={{ borderLeft: `2px solid ${C.gold}`, borderTop: `1px solid ${C.goldBorderXs}` }}>
                <Toggle
                  label="Double Riichi"
                  sub="Declared riichi on your very first discard."
                  value={doubleRiichi}
                  onChange={handleDoubleRiichi}
                />
              </div>
              <div className="pl-4 ml-0.5" style={{ borderLeft: `2px solid ${C.gold}`, borderTop: `1px solid ${C.goldBorderXs}` }}>
                <Stepper
                  label="Ura Dora"
                  sub="Revealed after winning with riichi. Count tiles in your hand whose suit and number come one after the dora indicator."
                  value={uraDora}
                  onChange={setUraDora}
                  min={0}
                  max={4}
                />
              </div>
            </>
          )}

          {/* Round & dora */}
          <Disclosure label="Round & dora">
            <Segmented
              label="Round wind"
              options={[
                { label: 'East', value: 'east' as WindValue },
                { label: 'South', value: 'south' as WindValue },
              ]}
              value={roundWind}
              onChange={setRoundWind}
            />
            <Segmented
              label="Seat wind"
              options={[
                { label: 'East', value: 'east' as WindValue },
                { label: 'South', value: 'south' as WindValue },
                { label: 'West', value: 'west' as WindValue },
                { label: 'North', value: 'north' as WindValue },
              ]}
              value={seatWind}
              onChange={handleSeatWind}
            />
          </Disclosure>

          {/* Special conditions */}
          <Disclosure label="Special conditions">
            <Toggle
              label="Haitei"
              sub="Won on the very last drawable tile. (Tsumo only)"
              value={haitei}
              onChange={setHaitei}
              disabled={winType !== 'tsumo'}
            />
            <Toggle
              label="Houtei"
              sub="Won on the very last discard. (Ron only)"
              value={houtei}
              onChange={setHoutei}
              disabled={winType !== 'ron'}
            />
            <Toggle
              label="Rinshan"
              sub="Drew the winning tile after declaring a kan. (Tsumo only)"
              value={rinshan}
              onChange={setRinshan}
              disabled={winType !== 'tsumo'}
            />
            <Toggle
              label="Chankan"
              sub="Won by stealing a tile added to an opponent's pon. (Ron only)"
              value={chankan}
              onChange={setChankan}
              disabled={winType !== 'ron'}
            />
          </Disclosure>
        </section>

        {/* ── Score button ──────────────────────────────────────────────── */}
        <div className="flex gap-2">
          <button
            onClick={handleScore}
            disabled={!canScore}
            className="flex-1 py-4 rounded-sm text-sm font-bold tracking-widest uppercase transition-colors shadow-none"
            style={{
              background: canScore ? C.gold : C.surfaceEl,
              color: canScore ? C.bg : C.textDim,
              border: canScore ? 'none' : `1px solid ${C.goldBorderSm}`,
            }}
            onMouseEnter={(e) => { if (canScore) e.currentTarget.style.background = C.goldBright; }}
            onMouseLeave={(e) => { if (canScore) e.currentTarget.style.background = C.gold; }}
          >
            Score Hand
          </button>
          {(handScanned || handTiles.length > 0 || result) && (
            <button
              onClick={handleClear}
              className="px-4 py-4 rounded-sm text-sm font-semibold tracking-widest uppercase transition-colors"
              style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.redText; e.currentTarget.style.color = C.redText; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.goldBorderSm; e.currentTarget.style.color = C.textSec; }}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Result ───────────────────────────────────────────────────── */}
        {result && <ResultPanel result={result} winType={winType} seatWind={seatWind} />}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="pt-6 pb-8 space-y-4 text-center">
          <div className="flex justify-center gap-2">
            <a
              href="mailto:support.riichicam@gmail.com?subject=RiichiCam Feedback"
              className="px-3 py-1.5 rounded-sm text-xs font-semibold tracking-wide transition-colors"
              style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.gold; (e.currentTarget as HTMLAnchorElement).style.color = C.gold; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.goldBorderSm; (e.currentTarget as HTMLAnchorElement).style.color = C.textSec; }}
            >
              Give Feedback
            </a>
            <a
              href="#"
              className="px-3 py-1.5 rounded-sm text-xs font-semibold tracking-wide transition-colors"
              style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.gold; (e.currentTarget as HTMLAnchorElement).style.color = C.gold; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.goldBorderSm; (e.currentTarget as HTMLAnchorElement).style.color = C.textSec; }}
            >
              ☕ Buy Me a Coffee
            </a>
          </div>
          <p className="text-xs" style={{ color: C.textDim }}>
            Made by{' '}
            <a
              href="https://nebulous-measure-795.notion.site/Mitchell-Magid-s-Project-Portfolio-0bc042300af94ff0ac3e65ba37cabf1b"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.textSec, textDecoration: 'underline', textUnderlineOffset: '3px' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.gold; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.textSec; }}
            >
              Mitchell Magid
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
