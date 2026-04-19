# RiichiCam — Architecture & Build Plan

## Architecture

```
lib/scoring/
  types.ts       # All public types: Tile, Hand, ScoreResult, RulesConfig, DEFAULT_RULES
  tiles.ts       # Tile utilities: equality, dora resolution, aka counting, sorting
  hand-parser.ts # Winning hand analysis: standard groupings, chiitoitsu, kokushi
  yaku.ts        # detectYaku() + detectYakuman() — pure functions over parsed hand
  fu.ts          # calculateFu(), chiitoitsiFuBreakdown()
  points.ts      # calculatePoints(), handName()
  index.ts       # score(hand, rules?) → ScoreResult — public entry point
  __tests__/
    scoring.test.ts  # 38 tests (vitest)
```

### Key design decisions

- `score()` is a pure function; no global state
- `Hand.closedTiles` does NOT include the winning tile (it's passed separately)
- Dealer derived from `seatWind === 'east'` only — no separate `dealer` field
- Chiitoitsu `FuBreakdown`: `base:25`, all others `0` (no sub-calculation)
- `WIND_DORA_ORDER` / `DRAGON_DORA_ORDER` are the single source of truth for dora indicator resolution
- `doubleWindPairFu: 2 | 4` in `RulesConfig` — default `4` (Mahjong Soul)
- `akaDoraCount: 0 | 3 | 4` in `RulesConfig` — default `3`; aka counted as dora not yaku
- Double-wind yakuhai: East triplet in East seat + East round = **2 han** (counted once per matching category)
- `MANGAN_BASIC = 2000` (the base payment unit; non-dealer ron = ×4 = 8000)
- Library: implemented from scratch — existing npm packages (riichi, riichi-hand) are unmaintained and incomplete

### Rules defaults (WRC/Mahjong Soul)

| Flag | Default | Note |
|---|---|---|
| kuitan | true | Open tanyao allowed |
| kiriagemangan | false | No rounding up |
| doubleYakuman | false | Treat as single |
| doubleWindPairFu | 4 | Mahjong Soul default |
| akaDoraCount | 3 | One per suit |

## Multi-step build plan

### Step 1 — Scoring engine (DONE)
- Next.js 14 App Router scaffold, TypeScript strict, Tailwind, Vitest
- Pure `score()` function, all yaku/yakuman, fu, points
- 38 tests passing, clean build

### Step 2 — Manual scoring UI
- Page: tile picker (select 13 closed tiles + winning tile + melds)
- Wind/flags form (seat wind, round wind, riichi, etc.)
- ScoreResult display: yaku list, fu breakdown, payment table
- No camera, no server state — all client-side

### Step 3 — Camera tile recognition
- Next.js API route or Server Action calling a vision model (e.g., Claude claude-sonnet-4-6)
- Upload photo → detect tiles → pre-fill the manual scorer
- Confidence display; user can correct misdetections

### Step 4 — Persistent history
- Store scored hands (Vercel Blob or Postgres via Marketplace)
- Simple list view with replay

### Step 5 — Polish
- Keyboard shortcuts, mobile layout
- Shareable hand links
- Riichi/rule variant settings page
