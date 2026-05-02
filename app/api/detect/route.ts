import { NextResponse } from 'next/server';
import {
  parsePredictions,
  roboflowLabelToTile,
  MIN_CONFIDENCE,
  type RawPrediction,
} from '@/lib/scoring/roboflow-parser';
import type { Tile } from '@/lib/scoring/types';

type SectionBox = { x: number; y: number; w: number; h: number };

interface RoboflowResponse {
  predictions?: RawPrediction[];
  image?: { width: number; height: number };
}

async function callRoboflow(apiKey: string, image: string): Promise<RoboflowResponse> {
  const url = `https://detect.roboflow.com/riichicam/1?api_key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    body: image,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Roboflow request failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Filter predictions into sections using pixel positions from the Roboflow response.
// Section boxes are fractions [0,1]; Roboflow returns image.width/height for the
// actual image it received, so we can convert fractions to pixels accurately.
function splitBySection(
  predictions: RawPrediction[],
  sections: Partial<Record<'hand' | 'winning' | 'dora', SectionBox>>,
  imgWidth: number,
  imgHeight: number,
): { hand: Tile[]; winningTile: Tile | null; dora: Tile[] } {
  const result: { hand: Tile[]; winningTile: Tile | null; dora: Tile[] } = {
    hand: [], winningTile: null, dora: [],
  };

  const qualified = predictions.filter((p) => p.confidence >= MIN_CONFIDENCE);

  for (const [key, box] of Object.entries(sections) as [string, SectionBox][]) {
    const x1 = box.x * imgWidth;
    const y1 = box.y * imgHeight;
    const x2 = (box.x + box.w) * imgWidth;
    const y2 = (box.y + box.h) * imgHeight;

    const inBox = qualified
      .filter((p) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2)
      .sort((a, b) => a.x - b.x);

    const tiles: Tile[] = [];
    for (const p of inBox) {
      try { tiles.push(roboflowLabelToTile(p.class)); } catch { /* skip unknown labels */ }
    }

    if (key === 'hand')    result.hand = tiles.slice(0, 13);
    if (key === 'winning') result.winningTile = tiles[0] ?? null;
    if (key === 'dora')    result.dora = tiles.slice(0, 8);
  }

  return result;
}

export async function POST(request: Request) {
  let body: {
    image?: string;
    mode?: string;
    sections?: Partial<Record<'hand' | 'winning' | 'dora', SectionBox>>;
  };

  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { image, mode = 'hand', sections } = body;

  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: 'Missing required field: image' }, { status: 400 });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ROBOFLOW_API_KEY is not configured' }, { status: 500 });
  }

  let roboflowData: RoboflowResponse;
  try {
    roboflowData = await callRoboflow(apiKey, image);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach Roboflow: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const rawPredictions = roboflowData.predictions ?? [];

  // ── Guided mode: full frame sent, filter predictions by bounding box ──────
  if (mode === 'guided' && sections && roboflowData.image?.width && roboflowData.image?.height) {
    try {
      const result = splitBySection(
        rawPredictions,
        sections,
        roboflowData.image.width,
        roboflowData.image.height,
      );
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse guided predictions: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }
  }

  // ── Individual mode ───────────────────────────────────────────────────────
  let tiles: Tile[];
  try {
    tiles = parsePredictions(rawPredictions);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse predictions: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 },
    );
  }

  if (tiles.length < 1) {
    return NextResponse.json(
      { error: 'No tiles detected. Try better lighting or a closer shot.' },
      { status: 422 },
    );
  }
  if (tiles.length > 18) {
    return NextResponse.json(
      { error: 'Too many tiles detected. Try scanning hand and dora separately.' },
      { status: 422 },
    );
  }

  return NextResponse.json({ tiles });
}
