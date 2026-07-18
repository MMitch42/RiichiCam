# RiichiCam - Architecture & Build Plan

## Architecture

```
lib/scoring/
  types.ts       # All public types: Tile, Hand, ScoreResult, RulesConfig, DEFAULT_RULES
  tiles.ts       # Tile utilities: equality, dora resolution, aka counting, sorting
  hand-parser.ts # Winning hand analysis: standard groupings, chiitoitsu, kokushi
  yaku.ts        # detectYaku() + detectYakuman() - pure functions over parsed hand
  fu.ts          # calculateFu(), chiitoitsiFuBreakdown()
  points.ts      # calculatePoints(), handName()
  index.ts       # score(hand, rules?) → ScoreResult - public entry point
  __tests__/
    scoring.test.ts      # 39 tests (vitest)
    fu-points.test.ts    # 28 tests
    roboflow-parser.test.ts  # 1 test
```

### Key design decisions

- `score()` is a pure function; no global state
- `Hand.closedTiles` does NOT include the winning tile (it's passed separately)
- Dealer derived from `seatWind === 'east'` only - no separate `dealer` field
- Chiitoitsu `FuBreakdown`: `base:25`, all others `0` (no sub-calculation)
- `WIND_DORA_ORDER` / `DRAGON_DORA_ORDER` are the single source of truth for dora indicator resolution
- `doubleWindPairFu: 2 | 4` in `RulesConfig` - default `4` (Mahjong Soul)
- `akaDoraCount: 0 | 3 | 4` in `RulesConfig` - default `3`; aka counted as dora not yaku
- Double-wind yakuhai: East triplet in East seat + East round = **2 han** (counted once per matching category)
- `MANGAN_BASIC = 2000` (the base payment unit; non-dealer ron = ×4 = 8000)
- Library: implemented from scratch - existing npm packages (riichi, riichi-hand) are unmaintained and incomplete

### Rules defaults (WRC/Mahjong Soul)

| Flag | Default | Note |
|---|---|---|
| kuitan | true | Open tanyao allowed |
| kiriagemangan | false | No rounding up |
| doubleYakuman | false | Treat as single |
| doubleWindPairFu | 4 | Mahjong Soul default |
| akaDoraCount | 3 | One per suit |

## Synthetic training data pipeline (v4 detector)

Offline tooling, no runtime dependency on the Next.js app — see
`synthetic/README.md` for full detail.

```
tools/tile-extractor/  # CV extraction of per-tile PNGs from real tileset photos
synthetic/
  render.py    # Blender scene/domain-randomization/render entrypoint
  layout.py    # plausible scene layout (hand/dora/winning), pure Python, no bpy
  packs.py     # face-art pack discovery + weighted per-scene selection
  bbox.py      # YOLO bbox projection math, pure Python
  export.py    # YOLOv8 dataset writer + phone-camera-realism post-process
  assets/faces/<pack>/<class>.png  # 6 packs: fluffystuff, tempai1, tempai2
                                    # (open-licensed art), tray1, mystic1,
                                    # numbered1 (real physical-set photos)
```

Renders labeled scenes automatically (every tile's class/position is known at
placement time, so YOLO boxes are exact with zero manual annotation) to
supplement — not replace — real photo training data. Key gotchas already hit
once, documented in `synthetic/README.md` so they aren't re-discovered:
tiles lie flat so a rotated (meld) tile's footprint is its face height not
its thickness; `render.py`'s camera solve only targets the hand row's own
width, so a safety net (`fit_tiles_in_frame`) widens the FOV if the dora row
or winning tile would otherwise crop significantly; Roboflow's dataset
version generation can scatter synthetic images into valid/test even when
uploaded as `train` (verify by searching the `scene_` filename prefix in
Valid/Test after generating a version, always).

## Multi-step build plan

### Step 1 - Scoring engine (DONE)
- Next.js 14 App Router scaffold, TypeScript strict, Tailwind, Vitest
- Pure `score()` function, all yaku/yakuman, fu, points
- 67 tests passing (scoring.test.ts + fu-points.test.ts), clean build

### Step 2 - Manual scoring UI (DONE)
- Tile picker: full 34-tile palette, winning tile, open melds (chi/pon/kan)
- Wind/flags form: seat/round wind, riichi, double riichi, ippatsu, haitei/houtei/rinshan/chankan/renho, honba
- ScoreResult display: yaku list with tooltips, fu breakdown panel, payment table, tenpai calculator
- Local storage for rules preferences

### Step 3 - Camera tile recognition (DONE, v4 model training in progress)
- Primary: Roboflow custom-trained model (`riichicam/3`) via `/api/detect`
- Fallback: Google Gemini 2.0 Flash via `/api/detect-gemini`
- Modes: individual (hand/dora/winning tile separately) and guided (full-frame with bounding box sections)
- User correction flow, scan preview with lightbox, training data saving to Vercel Blob with consent banner
- v4: retraining on real photos + a Blender synthetic-data pipeline (see
  above) to cover art styles, melds, and lighting the real corpus is thin on

### Step 4 - Persistent history (NOT STARTED)
- Training image storage exists (Vercel Blob) but no scored hand history
- Missing: hand history list view, replay, shareable hand links, Postgres/Neon integration

### Step 5 - Polish (PARTIAL)
- Done: mobile-first layout, PWA manifest + install banner, dark theme, Buy Me a Coffee link, landing page with FAQ
- Missing: keyboard shortcuts, dedicated rule variant settings page, shareable hand links (URL encoding)
