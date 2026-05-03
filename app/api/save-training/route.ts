import { NextResponse } from 'next/server';
import { saveTrainingImage, type TrainingMeta } from '@/lib/training-storage';

export async function POST(request: Request) {
  let body: { image?: string; meta?: TrainingMeta };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const { image, meta } = body;
  if (!image || !meta) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await saveTrainingImage(image, meta);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
