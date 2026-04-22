'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { score } from '@/lib/scoring';
import type { Hand, Meld, ScoreResult, Tile, WindValue } from '@/lib/scoring/types';
import CameraCapture from './components/CameraCapture';
import TileRow from './components/TileRow';
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

// ─── Result panel ─────────────────────────────────────────────────────────────

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
        {sortedYaku.map((y, i) => (
          <div
            key={i}
            className="flex justify-between py-2.5 font-mono text-sm"
            style={{ borderBottom: i < sortedYaku.length - 1 || totalDora > 0 ? `1px solid ${C.goldBorderXs}` : 'none' }}
          >
            <span style={{ color: C.text }}>{y.name}</span>
            <span className="font-semibold" style={{ color: C.gold }}>
              {y.isYakuman ? 'yakuman' : `${y.han} han`}
            </span>
          </div>
        ))}
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
  async function handleHandCapture(base64: string) {
    setIsDetectingHand(true);
    setDetectError(null);
    setHandScanned(true);
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
      setHandTiles(tiles.slice(0, 13));
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
      setDoraIndicatorTiles(data.tiles.slice(0, 4));
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
            <div>
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
          {showHandRows ? (
            <div className="space-y-4">
              <TileRow
                label="Hand tiles"
                tiles={handTiles}
                onChange={setHandTiles}
                maxTiles={13 - meldTileCount}
                usedTiles={usedTiles}
              />

              {(handScanned || handTiles.length > 0) && (
                <MeldBuilder
                  handTiles={handTiles}
                  melds={melds}
                  onHandTilesChange={setHandTiles}
                  onMeldsChange={setMelds}
                />
              )}

              <div
                className="-mx-4 px-4 pb-4 pt-4"
                style={{ background: C.surfaceEl, borderTop: `1px solid ${C.goldBorderXs}` }}
              >
                <TileRow
                  label="Winning tile"
                  tiles={winningTile ? [winningTile] : []}
                  onChange={(tiles) => setWinningTile(tiles[0] ?? null)}
                  maxTiles={1}
                  isWinning
                  usedTiles={usedTiles}
                />
              </div>
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
          {showDoraRow ? (
            <TileRow
              label="Dora indicators"
              tiles={doraIndicatorTiles}
              onChange={setDoraIndicatorTiles}
              maxTiles={4}
              usedTiles={usedTiles}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center" style={{ color: C.textSec }}>
                Tap &lsquo;Scan Dora&rsquo; to detect dora indicators automatically
              </p>
              <button
                onClick={() => setDoraScanned(true)}
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
        <button
          onClick={handleScore}
          disabled={!canScore}
          className="w-full py-4 rounded-sm text-sm font-bold tracking-widest uppercase transition-colors shadow-none"
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

        {/* ── Result ───────────────────────────────────────────────────── */}
        {result && <ResultPanel result={result} winType={winType} seatWind={seatWind} />}
      </div>
    </main>
  );
}
