# RiichiCam

Riichi mahjong hand scorer with camera tile detection. Scan your hand, confirm conditions, get a full score breakdown: fu, han, yaku list, and payment table.

Built with Next.js App Router, TypeScript, and Tailwind CSS. Deployed on Vercel.

**[Live app](http://riichi-cam.vercel.app) · [Give feedback](mailto:support.riichicam@gmail.com?subject=RiichiCam%20Feedback)**

---

## Features

- **Guided scan:** one shot captures hand, winning tile, and dora/ura dora simultaneously using bounding box overlays
- **Camera detection:** Roboflow computer vision model detects tiles from a photo; individual scans also supported for hand and dora separately
- **Flash toggle:** torch on/off button in the guided camera overlay (on supported devices)
- **Manual input:** tap tiles from the full palette if preferred, including red 5 (aka dora) variants
- **Meld support:** declare chi, pon, and kan; kan auto-fills the 4th tile if you have 3 in hand
- **Tenpai detection:** waiting tiles highlighted automatically once 13 tiles are set; non-tenpai hands flagged before you try to score
- **Full scoring engine:** all standard yaku, all yakuman, fu breakdown, tsumo/ron payment table, honba bonus
- **Auto-sort:** scanned tiles sorted automatically (man > pin > sou > winds > dragons)
- **WRC / Mahjong Soul rules:** kuitan on, double yakuman off, 3 aka dora

---

## Scanning tips

- **Guided scan** is the recommended path. Frame your hand, winning tile, and dora indicators in the labelled boxes before pressing the shutter.
- Scan in **landscape orientation** for best results; a hint is shown if portrait is detected.
- Good lighting matters more than camera resolution; use the flash button if needed.
- After scanning, correct any misdetections by tapping tiles to remove/re-add them.
- Dora and ura dora indicators are scanned together in the Dora / Ura Dora box.

---

## Scoring engine

Pure TypeScript, zero runtime dependencies. Entry point:

```typescript
import { score } from "@/lib/scoring";
import type { Hand, ScoreResult } from "@/lib/scoring/types";

const result: ScoreResult = score(hand);
// with custom rules:
const result: ScoreResult = score(hand, { kuitan: false, kiriagemangan: true });
```

**Supported yaku:** riichi, double riichi, ippatsu, tsumo, tanyao, pinfu, iipeiko, ryanpeiko, yakuhai, chanta, junchan, sanshoku doujun, sanshoku doukou, ittsu, toitoi, sanankou, sankantsu, honitsu, chinitsu, chiitoitsu, rinshan, chankan, haitei, houtei, shousangen, and all yakuman (kokushi, suuankou, daisangen, shousuushii, daisuushii, tsuuiisou, ryuuiisou, chinroutou, chuuren, suukantsu, tenhou, chiihou).

**Rules config**

| Flag | Default | Note |
|---|---|---|
| `kuitan` | `true` | Open tanyao allowed |
| `kiriagemangan` | `false` | No rounding up to mangan |
| `doubleYakuman` | `false` | Treat as single yakuman |
| `doubleWindPairFu` | `4` | Mahjong Soul default |
| `akaDoraCount` | `3` | One per suit |

780 tests via Vitest.

---

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # scoring engine tests (vitest)
```

Copy `.env.example` to `.env.local` and fill in your keys:

```
ROBOFLOW_API_KEY=your_key_here
```

The active detection model is at `detect.roboflow.com/riichicam/3`. To switch versions, change the number in `app/api/detect/route.ts`.

A Gemini-based vision pipeline is preserved at `app/api/detect-gemini/route.ts` as a drop-in alternative (requires `GEMINI_API_KEY`).

---

## Project structure

```
app/
  page.tsx                      # main UI: tile input, conditions, score display
  layout.tsx                    # root layout
  globals.css                   # design tokens (dark slate + gold)
  api/
    detect/route.ts             # active inference route (Roboflow)
    detect-gemini/route.ts      # alternative inference route (Gemini)
  components/
    CameraCapture.tsx           # scan button + camera/library/paste menu
    GuidedCapture.tsx           # full-screen guided scan overlay with section boxes
    TileRow.tsx                 # tile display row + full tile palette
    TileGraphic.tsx             # individual tile illustrations (SVG)
    MeldBuilder.tsx             # chi/pon/kan meld input UI
lib/scoring/
  index.ts                      # score(hand, rules?) -> ScoreResult
  types.ts                      # all public types
  tiles.ts                      # tile utilities, dora resolution, sortTiles
  hand-parser.ts                # hand grouping (standard, chiitoitsu, kokushi)
  yaku.ts                       # detectYaku() + detectYakuman()
  fu.ts                         # calculateFu()
  points.ts                     # calculatePoints(), payment table
  roboflow-parser.ts            # Roboflow label -> Tile mapping
  gemini-parser.ts              # Gemini response -> Tile mapping
  __tests__/
    scoring.test.ts             # 780 tests
```

---

## Open source credits

**Tile graphics:** [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles).
SVG tile images used in the tile picker and score display. Released into the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

**Detection dataset:** Mahjong tile dataset sourced via [Roboflow Universe](https://universe.roboflow.com), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
