'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { score } from '@/lib/scoring';
import type { Hand, ScoreResult, Tile, WindValue } from '@/lib/scoring/types';
import CameraCapture from './components/CameraCapture';
import TileRow from './components/TileRow';

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
      <div className="flex items-center justify-between">
        <span className="text-base font-medium" style={{ color: '#f5f0e8' }}>{label}</span>
        <button
          onClick={() => onChange(!value)}
          aria-pressed={value}
          className="relative w-12 h-6 rounded-full transition-colors focus-visible:outline-none"
          style={{ background: value ? '#d4a843' : '#222536' }}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              value ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {sub && <p className="text-sm mt-0.5 pr-14" style={{ color: '#8b8fa8' }}>{sub}</p>}
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
      <div className="flex items-center justify-between">
        <span className="text-base font-medium" style={{ color: '#f5f0e8' }}>{label}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-9 h-9 rounded-full text-xl font-medium flex items-center justify-center disabled:opacity-40"
            style={{ background: '#222536', color: '#f5f0e8', border: '1px solid #2a2d3a' }}
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-semibold" style={{ color: '#f5f0e8' }}>{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-9 h-9 rounded-full text-xl font-medium flex items-center justify-center disabled:opacity-40"
            style={{ background: '#222536', color: '#f5f0e8', border: '1px solid #2a2d3a' }}
          >
            +
          </button>
        </div>
      </div>
      {sub && <p className="text-sm mt-0.5" style={{ color: '#8b8fa8' }}>{sub}</p>}
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
      <p className="text-base font-medium mb-2" style={{ color: '#f5f0e8' }}>{label}</p>
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2a2d3a', background: '#222536' }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex-1 py-2.5 text-sm font-medium transition-colors"
            style={
              value === opt.value
                ? { background: '#d4a843', color: '#0f1117' }
                : { background: 'transparent', color: '#8b8fa8' }
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
    <div style={{ borderTop: '1px solid #2a2d3a' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-base font-medium" style={{ color: '#f5f0e8' }}>{label}</span>
        <span className="text-sm" style={{ color: '#8b8fa8' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="pb-3 space-y-0">{children}</div>}
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
}: {
  result: ScoreResult;
  winType: 'tsumo' | 'ron';
}) {
  const [fuOpen, setFuOpen] = useState(false);

  if (!result.valid) {
    return (
      <div className="rounded-xl p-4" style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}>
        <p className="font-semibold" style={{ color: '#e05252' }}>Invalid hand</p>
        <p className="text-sm mt-1" style={{ color: '#e05252' }}>{result.error}</p>
      </div>
    );
  }

  const sortedYaku = [...result.yaku].sort((a, b) => b.han - a.han);
  const totalDora = result.doraCount + result.uraDoraCount;
  const grandTotal = result.totalHan + totalDora;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}>
      {/* Points header */}
      <div className="px-4 py-5" style={{ background: '#222536', borderBottom: '1px solid #2a2d3a' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="leading-none font-bold" style={{ fontSize: '3rem', color: '#d4a843' }}>
              {result.points.total.toLocaleString()}
            </p>
            <p className="text-sm mt-1" style={{ color: '#8b8fa8' }}>points</p>
          </div>
          {result.handName && (
            <span
              className="mt-1 shrink-0 px-2.5 py-1 rounded-md text-sm font-bold uppercase tracking-widest"
              style={{ background: '#d4a843', color: '#0f1117', letterSpacing: '0.08em' }}
            >
              {HAND_NAME_LABELS[result.handName] ?? result.handName.toUpperCase()}
            </span>
          )}
        </div>
        {winType === 'tsumo' && result.points.tsumo && (
          <p className="text-sm mt-3" style={{ color: '#f5f0e8' }}>
            Dealer pays{' '}
            <span className="font-medium">{result.points.tsumo.dealerPays.toLocaleString()}</span>{' '}
            · Non-dealer pays{' '}
            <span className="font-medium">
              {result.points.tsumo.nonDealerPays.toLocaleString()}
            </span>{' '}
            each
          </p>
        )}
        {winType === 'ron' && result.points.ron !== undefined && (
          <p className="text-sm mt-3" style={{ color: '#f5f0e8' }}>
            Opponent pays you{' '}
            <span className="font-medium">{result.points.ron.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Yaku list */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid #2a2d3a' }}>
        {sortedYaku.map((y, i) => (
          <div
            key={i}
            className="flex justify-between py-2"
            style={{ borderBottom: i < sortedYaku.length - 1 || totalDora > 0 ? '1px solid #2a2d3a' : 'none' }}
          >
            <span style={{ color: '#f5f0e8' }}>{y.name}</span>
            <span className="font-medium" style={{ color: '#d4a843' }}>
              {y.isYakuman ? 'yakuman' : `${y.han} han`}
            </span>
          </div>
        ))}
        {totalDora > 0 && (
          <div className="flex justify-between py-2">
            <span style={{ color: '#f5f0e8' }}>
              Dora
              {result.uraDoraCount > 0 &&
                ` (${result.doraCount} + ${result.uraDoraCount} ura)`}
            </span>
            <span className="font-medium" style={{ color: '#d4a843' }}>{totalDora} han</span>
          </div>
        )}
      </div>

      {/* Han + fu */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid #2a2d3a' }}>
        <p className="text-sm" style={{ color: '#8b8fa8' }}>
          {grandTotal} han / {result.fu} fu
        </p>
      </div>

      {/* Fu breakdown */}
      <div>
        <button
          onClick={() => setFuOpen(!fuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium" style={{ color: '#f5f0e8' }}>Fu breakdown</span>
          <span className="text-xs" style={{ color: '#8b8fa8' }}>{fuOpen ? '▴' : '▾'}</span>
        </button>
        {fuOpen && (
          <div className="px-4 pb-3 space-y-1">
            {[
              { label: 'Base fu', val: result.fuBreakdown.base },
              { label: 'Meld fu', val: result.fuBreakdown.meldFu },
              { label: 'Pair fu', val: result.fuBreakdown.pairFu },
              { label: 'Wait fu', val: result.fuBreakdown.waitFu },
              { label: 'Tsumo fu', val: result.fuBreakdown.tsumoFu },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: '#8b8fa8' }}>{label}</span>
                <span style={{ color: '#f5f0e8' }}>{val}</span>
              </div>
            ))}
            <div
              className="flex justify-between text-sm font-semibold pt-2 mt-1"
              style={{ borderTop: '1px solid #2a2d3a', color: '#f5f0e8' }}
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

  // ── Dora count (kept in UI for manual override) ───────────────────────────
  const [akaDora, setAkaDora] = useState(0);
  const [doraCt, setDoraCt] = useState(0);

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
    if (handTiles.length !== 13 || !winningTile) return null;
    return {
      closedTiles: handTiles,
      winningTile,
      melds: [],
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

  const canScore = handTiles.length === 13 && winningTile !== null;
  const isRiichi = riichi || doubleRiichi;
  const showHandRows = handScanned || handTiles.length > 0 || winningTile !== null;
  const showDoraRow = doraScanned || doraIndicatorTiles.length > 0;

  // suppress unused-var warnings for kept UI state
  void akaDora;
  void doraCt;

  return (
    <main style={{ minHeight: '100vh', background: '#0f1117' }}>
      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        {/* ── Header banner ───────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden -mx-0"
          style={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderTop: '4px solid #d4a843' }}
        >
          <div className="px-4 py-4 flex items-center gap-3">
            {/* Mahjong tile SVG icon */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-lg"
              style={{ width: 48, height: 48, background: '#222536', border: '1px solid #2a2d3a' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Tile outline */}
                <rect x="4" y="3" width="24" height="26" rx="3" fill="#2a2d3a" stroke="#d4a843" strokeWidth="1.5"/>
                {/* 中 character — simplified dragon tile */}
                <text x="16" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill="#d4a843" fontFamily="serif">中</text>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ color: '#f5f0e8' }}>RiichiCam</h1>
              <p className="text-sm mt-0.5" style={{ color: '#8b8fa8' }}>Riichi mahjong score calculator</p>
            </div>
          </div>
        </div>

        {/* ── Hand scan ──────────────────────────────────────────────────── */}
        <section
          className="rounded-xl p-4 space-y-4"
          style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}
        >
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
                maxTiles={13}
              />
              <div
                className="-mx-4 px-4 pb-4 pt-4 rounded-b-xl"
                style={{ background: '#222536', borderTop: '1px solid #2a2d3a', borderLeft: '4px solid #d4a843' }}
              >
                <TileRow
                  label="Winning tile"
                  tiles={winningTile ? [winningTile] : []}
                  onChange={(tiles) => setWinningTile(tiles[0] ?? null)}
                  maxTiles={1}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center" style={{ color: '#8b8fa8' }}>
                Tap &lsquo;Scan Hand&rsquo; to detect tiles automatically
              </p>
              <button
                onClick={() => setHandScanned(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid #2a2d3a', color: '#8b8fa8', background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d4a843')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2d3a')}
              >
                Input Manually
              </button>
            </div>
          )}
        </section>

        {/* ── Dora scan ──────────────────────────────────────────────────── */}
        <section
          className="rounded-xl p-4 space-y-4"
          style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}
        >
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
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center" style={{ color: '#8b8fa8' }}>
                Tap &lsquo;Scan Dora&rsquo; to detect dora indicators automatically
              </p>
              <button
                onClick={() => setDoraScanned(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: '1px solid #2a2d3a', color: '#8b8fa8', background: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#d4a843')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2d3a')}
              >
                Input Manually
              </button>
            </div>
          )}
        </section>

        {/* ── Detection error ─────────────────────────────────────────────── */}
        {detectError && (
          <p className="text-sm font-medium" style={{ color: '#e05252' }}>{detectError}</p>
        )}

        {/* ── Conditions ─────────────────────────────────────────────────── */}
        <section
          className="rounded-xl px-4"
          style={{ background: '#1a1d27', border: '1px solid #2a2d3a' }}
        >
          {/* Tsumo / Ron */}
          <div className="py-3">
            <p className="text-base font-medium mb-2" style={{ color: '#f5f0e8' }}>Win type</p>
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: '1px solid #2a2d3a', background: '#222536' }}
            >
              {(['tsumo', 'ron'] as const).map((wt) => (
                <button
                  key={wt}
                  onClick={() => handleWinType(wt)}
                  className="flex-1 py-3 text-base font-semibold transition-colors"
                  style={
                    winType === wt
                      ? { background: '#d4a843', color: '#0f1117' }
                      : { background: 'transparent', color: '#8b8fa8' }
                  }
                >
                  {wt === 'tsumo' ? 'Tsumo' : 'Ron'}
                </button>
              ))}
            </div>
          </div>

          {/* Dealer */}
          <div style={{ borderTop: '1px solid #2a2d3a' }}>
            <Toggle
              label="I am dealer (East seat)"
              value={dealer}
              onChange={handleDealer}
            />
          </div>

          {/* Riichi */}
          <div style={{ borderTop: '1px solid #2a2d3a' }}>
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
              <div className="pl-4 ml-1" style={{ borderLeft: '2px solid #d4a843', borderTop: '1px solid #2a2d3a' }}>
                <Toggle
                  label="Ippatsu"
                  sub="Won within one round of discards after riichi."
                  value={ippatsu}
                  onChange={setIppatsu}
                />
              </div>
              <div className="pl-4 ml-1" style={{ borderLeft: '2px solid #d4a843', borderTop: '1px solid #2a2d3a' }}>
                <Toggle
                  label="Double Riichi"
                  sub="Declared riichi on your very first discard."
                  value={doubleRiichi}
                  onChange={handleDoubleRiichi}
                />
              </div>
              <div className="pl-4 ml-1" style={{ borderLeft: '2px solid #d4a843', borderTop: '1px solid #2a2d3a' }}>
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
            <Stepper
              label="Aka dora"
              sub="Red fives in your hand."
              value={akaDora}
              onChange={setAkaDora}
              min={0}
              max={3}
            />
            <Stepper
              label="Dora count"
              sub="How many of your tiles match the dora indicator."
              value={doraCt}
              onChange={setDoraCt}
              min={0}
              max={8}
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

        {/* ── Score button ────────────────────────────────────────────────── */}
        <button
          onClick={handleScore}
          disabled={!canScore}
          className="w-full py-4 rounded-xl text-lg font-bold shadow-sm transition-colors"
          style={{
            background: canScore ? '#d4a843' : '#2a2d3a',
            color: canScore ? '#0f1117' : '#8b8fa8',
          }}
        >
          Score Hand
        </button>

        {/* ── Result ──────────────────────────────────────────────────────── */}
        {result && <ResultPanel result={result} winType={winType} />}
      </div>
    </main>
  );
}
