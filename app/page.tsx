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
        <span className="text-base font-medium text-gray-900">{label}</span>
        <button
          onClick={() => onChange(!value)}
          aria-pressed={value}
          className={`relative w-12 h-6 rounded-full transition-colors focus-visible:outline-none ${
            value ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              value ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {sub && <p className="text-sm text-gray-500 mt-0.5 pr-14">{sub}</p>}
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
        <span className="text-base font-medium text-gray-900">{label}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-9 h-9 rounded-full bg-gray-200 text-xl font-medium flex items-center justify-center disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center text-lg font-semibold">{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-9 h-9 rounded-full bg-gray-200 text-xl font-medium flex items-center justify-center disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
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
      <p className="text-base font-medium text-gray-900 mb-2">{label}</p>
      <div className="flex rounded-lg overflow-hidden border border-gray-200">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              value === opt.value
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700'
            }`}
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
    <div className="border-t border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-base font-medium text-gray-700">{label}</span>
        <span className="text-gray-400 text-sm">{open ? '▴' : '▾'}</span>
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
      <div className="rounded-xl bg-red-50 border border-red-200 p-4">
        <p className="text-red-700 font-semibold">Invalid hand</p>
        <p className="text-red-600 text-sm mt-1">{result.error}</p>
      </div>
    );
  }

  const sortedYaku = [...result.yaku].sort((a, b) => b.han - a.han);
  const totalDora = result.doraCount + result.uraDoraCount;
  const grandTotal = result.totalHan + totalDora;

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Points header */}
      <div className="bg-gray-50 px-4 py-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-5xl font-bold text-gray-900 leading-none">
              {result.points.total.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm mt-1">points</p>
          </div>
          {result.handName && (
            <span className="mt-1 shrink-0 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-sm font-bold tracking-wide">
              {HAND_NAME_LABELS[result.handName] ?? result.handName.toUpperCase()}
            </span>
          )}
        </div>
        {winType === 'tsumo' && result.points.tsumo && (
          <p className="text-sm text-gray-600 mt-3">
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
          <p className="text-sm text-gray-600 mt-3">
            Opponent pays you{' '}
            <span className="font-medium">{result.points.ron.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Yaku list */}
      <div className="px-4 py-2 divide-y divide-gray-100">
        {sortedYaku.map((y, i) => (
          <div key={i} className="flex justify-between py-2">
            <span className="text-gray-800">{y.name}</span>
            <span className="font-medium text-gray-900">
              {y.isYakuman ? 'yakuman' : `${y.han} han`}
            </span>
          </div>
        ))}
        {totalDora > 0 && (
          <div className="flex justify-between py-2">
            <span className="text-gray-800">
              Dora
              {result.uraDoraCount > 0 &&
                ` (${result.doraCount} + ${result.uraDoraCount} ura)`}
            </span>
            <span className="font-medium text-gray-900">{totalDora} han</span>
          </div>
        )}
      </div>

      {/* Han + fu */}
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-sm text-gray-500">
          {grandTotal} han / {result.fu} fu
        </p>
      </div>

      {/* Fu breakdown */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setFuOpen(!fuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-medium text-gray-600">Fu breakdown</span>
          <span className="text-gray-400 text-xs">{fuOpen ? '▴' : '▾'}</span>
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
                <span className="text-gray-500">{label}</span>
                <span className="text-gray-800">{val}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-1">
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">RiichiCam</h1>

        {/* ── Hand scan ──────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
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
              <div className="border-t border-gray-100 pt-4 bg-blue-50 -mx-4 px-4 pb-4 rounded-b-xl">
                <TileRow
                  label="Winning tile"
                  tiles={winningTile ? [winningTile] : []}
                  onChange={(tiles) => setWinningTile(tiles[0] ?? null)}
                  maxTiles={1}
                />
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg px-3 py-4 text-sm text-gray-400 text-center">
              Tap &lsquo;Scan Hand&rsquo; to detect tiles
            </div>
          )}
        </section>

        {/* ── Dora scan ──────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
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
            <div className="border-2 border-dashed border-gray-200 rounded-lg px-3 py-4 text-sm text-gray-400 text-center">
              Tap &lsquo;Scan Dora&rsquo; to detect dora indicators
            </div>
          )}
        </section>

        {/* ── Detection error ─────────────────────────────────────────────── */}
        {detectError && (
          <p className="text-sm text-red-600 font-medium">{detectError}</p>
        )}

        {/* ── Conditions ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 divide-y divide-gray-100">
          {/* Tsumo / Ron */}
          <div className="py-3">
            <p className="text-base font-medium text-gray-900 mb-2">Win type</p>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              {(['tsumo', 'ron'] as const).map((wt) => (
                <button
                  key={wt}
                  onClick={() => handleWinType(wt)}
                  className={`flex-1 py-3 text-base font-semibold transition-colors ${
                    winType === wt ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  {wt === 'tsumo' ? 'Tsumo' : 'Ron'}
                </button>
              ))}
            </div>
          </div>

          {/* Dealer */}
          <Toggle
            label="I am dealer (East seat)"
            value={dealer}
            onChange={handleDealer}
          />

          {/* Riichi */}
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

          {/* Riichi sub-options */}
          {isRiichi && (
            <>
              <div className="pl-4 border-l-2 border-blue-200 ml-1">
                <Toggle
                  label="Ippatsu"
                  sub="Won within one round of discards after riichi."
                  value={ippatsu}
                  onChange={setIppatsu}
                />
              </div>
              <div className="pl-4 border-l-2 border-blue-200 ml-1">
                <Toggle
                  label="Double Riichi"
                  sub="Declared riichi on your very first discard."
                  value={doubleRiichi}
                  onChange={handleDoubleRiichi}
                />
              </div>
              <div className="pl-4 border-l-2 border-blue-200 ml-1">
                <Stepper
                  label="Ura Dora"
                  sub="Bonus dora revealed after a riichi win. Count how many match."
                  value={uraDora}
                  onChange={setUraDora}
                  min={0}
                  max={4}
                />
              </div>
            </>
          )}

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
        </section>

        {/* ── Score button ────────────────────────────────────────────────── */}
        <button
          onClick={handleScore}
          disabled={!canScore}
          className="w-full py-4 rounded-xl bg-blue-500 text-white text-lg font-bold shadow-sm active:bg-blue-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Score Hand
        </button>

        {/* ── Result ──────────────────────────────────────────────────────── */}
        {result && <ResultPanel result={result} winType={winType} />}
      </div>
    </main>
  );
}
