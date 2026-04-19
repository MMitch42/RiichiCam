# RiichiCam

Riichi mahjong scoring web app with camera tile detection.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # run scoring engine tests (vitest)
```

## Status

**Step 1 complete**: Pure TypeScript scoring engine with full test suite.

- `lib/scoring/types.ts` — all public types and `DEFAULT_RULES`
- `lib/scoring/tiles.ts` — tile utilities, dora resolution
- `lib/scoring/hand-parser.ts` — winning hand grouping (standard, chiitoitsu, kokushi)
- `lib/scoring/yaku.ts` — all standard yaku + all yakuman detection
- `lib/scoring/fu.ts` — fu calculation with pinfu/chiitoitsu special cases
- `lib/scoring/points.ts` — payment calculation, named hand thresholds
- `lib/scoring/index.ts` — `score(hand, rules?)` entry point

38 tests passing, clean build.

## API

```typescript
import { score } from "@/lib/scoring";
import type { Hand, ScoreResult } from "@/lib/scoring/types";

const result: ScoreResult = score(hand);
const result: ScoreResult = score(hand, { kuitan: false, kiriagemangan: true });
```
