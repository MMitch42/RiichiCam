import { NextResponse } from 'next/server';
import { parseGeminiGuided, parseGeminiIndividual } from '@/lib/scoring/gemini-parser';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TILE_NOTATION = `Tile notation:
- Suited tiles: number + suit letter  (m = characters/man, p = circles/pin, s = bamboo/sou)
  e.g. "1m" "7p" "9s"
- Red 5s (aka dora): "5mr" "5pr" "5sr"
- Honor tiles: "east" "south" "west" "north" "haku" "hatsu" "chun"`;

type IndividualMode = 'hand' | 'winning' | 'dora';
type SectionBox = { x: number; y: number; w: number; h: number };

function buildIndividualPrompt(mode: IndividualMode): string {
  const desc: Record<IndividualMode, string> = {
    hand:    'These are the closed hand tiles (typically 13 tiles). List every tile you can see.',
    winning: 'This is a single winning/drawn mahjong tile. Identify the one tile.',
    dora:    'These are dora and/or ura dora indicator tiles (1–4 tiles). List all you can see.',
  };
  return `You are identifying riichi mahjong tiles in a photo.
${desc[mode]}

${TILE_NOTATION}

Respond with ONLY valid JSON — no markdown, no explanation:
{"tiles": ["1m", "2p", "3s"]}`;
}

function buildGuidedPrompt(
  sections: Partial<Record<'hand' | 'winning' | 'dora', SectionBox>>,
): string {
  const regionLines: string[] = [];
  for (const [key, box] of Object.entries(sections) as [string, SectionBox][]) {
    const x1 = Math.round(box.x * 100);
    const y1 = Math.round(box.y * 100);
    const x2 = Math.round((box.x + box.w) * 100);
    const y2 = Math.round((box.y + box.h) * 100);
    const label =
      key === 'hand'    ? 'HAND TILES — the 13 closed tiles (do NOT include open melds here)' :
      key === 'winning' ? 'WINNING TILE — a single tile separate from the hand' :
                          'DORA / URA DORA INDICATORS — 1–4 indicator tiles';
    regionLines.push(`  - ${label}: x ${x1}%–${x2}%,  y ${y1}%–${y2}%`);
  }

  return `You are analyzing a photo of a riichi mahjong hand.

Sections visible in the image (as % of image width/height):
${regionLines.join('\n')}

Also look for open melds — groups of tiles rotated 90° or clearly separated from the closed hand (called tiles placed face-up). These should NOT be included in the "hand" array.

${TILE_NOTATION}

Respond with ONLY valid JSON — no markdown, no explanation. Omit sections you cannot clearly see (use [] or null):
{
  "hand": ["1m","2p","3s"],
  "winning_tile": "4m",
  "dora": ["5p"],
  "melds": [{"type":"chi","tiles":["1m","2m","3m"]}]
}`;
}

async function callGemini(
  apiKey: string,
  prompt: string,
  imageBase64: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
      ]}],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('No content in Gemini response');

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse Gemini response as JSON');
  }
}

export async function POST(request: Request) {
  let body: {
    image?: string;
    mode?: string;
    sections?: Partial<Record<'hand' | 'winning' | 'dora', SectionBox>>;
    isLandscape?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { image, mode = 'hand', sections } = body;

  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: 'Missing required field: image' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured — add it to .env.local' },
      { status: 500 },
    );
  }

  try {
    if (mode === 'guided') {
      const prompt = buildGuidedPrompt(sections ?? {});
      const json = await callGemini(apiKey, prompt, image);
      const result = parseGeminiGuided(json);
      return NextResponse.json(result);
    }

    const validMode: IndividualMode = (['hand', 'winning', 'dora'] as const).includes(mode as IndividualMode)
      ? (mode as IndividualMode)
      : 'hand';
    const prompt = buildIndividualPrompt(validMode);
    const json = await callGemini(apiKey, prompt, image);
    const tiles = parseGeminiIndividual(json);

    if (tiles.length < 1) {
      return NextResponse.json(
        { error: 'No tiles detected. Try better lighting or a closer shot.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ tiles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Detection failed' },
      { status: 502 },
    );
  }
}
