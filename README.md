# RiichiCam

Riichi mahjong hand scorer with camera tile detection. Scan your hand, confirm conditions, get a full score breakdown: fu, han, yaku list, and payment table.

Built with Next.js App Router, TypeScript, Tailwind CSS, and a private GPU inference service. Deployed on Vercel.

A standalone V100 inference service is in `services/inference/`. The browser sends
scan images to RiichiCam's Vercel broker, which authenticates to the private service.
The browser never downloads a detector model or a model runtime.

**[Live app](http://riichicam.com) · [Give feedback](mailto:support.riichicam@gmail.com?subject=RiichiCam%20Feedback)**

---

## Features

- **Guided scan:** one shot captures hand, winning tile, and dora/ura dora simultaneously using bounding box overlays
- **Camera detection:** private GPU-backed object detection identifies tiles from a photo; images are processed only for the scan and not retained unless you opt in to training-data contribution. Individual scans also supported for hand and dora separately
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

Server and scoring tests cover scoring, fu/points, detection post-processing, and the
private inference broker.

---

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # test suite (vitest)
```

All production scans use the private inference service. The browser does not contain
or run a detector model. The private model is mounted read-only into the VM container; see
[`services/inference/README.md`](services/inference/README.md) for the existing-host
Caddy/HTTPS deployment steps.

Copy `.env.example` to `.env.local` if you want the optional pieces:

```
GEMINI_API_KEY=
BLOB_READ_WRITE_TOKEN=
RIICHICAM_SERVER_INFERENCE_ENABLED=false
RIICHICAM_INFERENCE_URL=
RIICHICAM_INFERENCE_TOKEN=
```

A Gemini-based vision pipeline is preserved at `app/api/detect-gemini/route.ts`
as a drop-in alternative, not wired into the main flow (requires
`GEMINI_API_KEY`). `BLOB_READ_WRITE_TOKEN` enables optional training-data
image storage via Vercel Blob (`/api/save-training`), gated behind user
consent in the app.

`/api/detect-server` is the server-only broker between the browser and the
private VM. It returns `503` unless `RIICHICAM_SERVER_INFERENCE_ENABLED=true`
and forwards only to `RIICHICAM_INFERENCE_URL` using the server-only
`RIICHICAM_INFERENCE_TOKEN`. Never prefix either value with `NEXT_PUBLIC_`.

---

## Project structure

```
app/
  page.tsx                      # main UI: tile input, conditions, score display
  layout.tsx                    # root layout
  globals.css                   # design tokens (dark slate + gold)
  score/page.tsx                # scanning + scoring flow, private-server detection wiring
  api/
    detect-gemini/route.ts       # alternative inference route (Gemini), not wired into the main flow
    detect-server/route.ts       # authenticated Vercel broker for private VM inference
    save-training/route.ts       # optional training-data image storage (Vercel Blob)
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
  roboflow-parser.ts            # detection label -> Tile mapping (name is historical)
  gemini-parser.ts              # Gemini response -> Tile mapping
  __tests__/
    scoring.test.ts
lib/detection/
  server.ts                     # browser client for the authenticated detection broker
  sections.ts                   # buckets predictions into hand/winning/dora for guided scan
  __tests__/
services/inference/
  docker-compose.vm.example.yml  # isolated V100 + Caddy/HTTPS deployment
```

---

## Open source credits

**Tile graphics:** [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles).
SVG tile images used in the tile picker and score display. Released into the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

**Detection service:** RiichiCam's production detector is hosted privately. The browser sends
a scan only to request detection results. It does not receive model weights, model metadata,
or a model runtime.
