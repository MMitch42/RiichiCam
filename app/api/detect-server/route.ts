import { NextResponse } from 'next/server';

export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4_000_000;
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4;

function enabled(): boolean {
  return process.env.RIICHICAM_SERVER_INFERENCE_ENABLED?.toLowerCase() === 'true';
}

function inferenceConfig(): { url: string; token: string } {
  const url = process.env.RIICHICAM_INFERENCE_URL?.replace(/\/$/, '');
  const token = process.env.RIICHICAM_INFERENCE_TOKEN;
  if (!url || !token) throw new Error('server_inference_not_configured');
  return { url, token };
}

function jpegFromBase64(image: string): Uint8Array<ArrayBuffer> {
  const encoded = image.startsWith('data:image/jpeg;base64,')
    ? image.slice('data:image/jpeg;base64,'.length)
    : image;

  if (encoded.length === 0) throw new Error('image_required');
  if (encoded.length > MAX_BASE64_LENGTH) throw new Error('image_too_large');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('invalid_base64');

  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0) throw new Error('image_required');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('image_too_large');
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('jpeg_required');
  return Uint8Array.from(bytes);
}

function publicDetectionResponse(payload: unknown): { image: unknown; predictions: unknown } | null {
  if (!payload || typeof payload !== 'object') return null;
  const response = payload as Record<string, unknown>;
  if (!response.image || !Array.isArray(response.predictions)) return null;
  return { image: response.image, predictions: response.predictions };
}

export async function POST(request: Request): Promise<Response> {
  if (!enabled()) {
    return NextResponse.json({ error: 'server_inference_disabled' }, { status: 503 });
  }

  let body: { image?: unknown; confidence?: unknown; iou?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.image !== 'string') {
    return NextResponse.json({ error: 'image_required' }, { status: 400 });
  }

  let image: Uint8Array<ArrayBuffer>;
  try {
    image = jpegFromBase64(body.image);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_image';
    const status = code === 'image_too_large' ? 413 : code === 'jpeg_required' ? 415 : 400;
    return NextResponse.json({ error: code }, { status });
  }

  const confidence =
    typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1
      ? body.confidence
      : 0.45;
  const iou =
    typeof body.iou === 'number' && body.iou >= 0 && body.iou <= 1 ? body.iou : 0.5;

  try {
    const config = inferenceConfig();
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    const upstream = await fetch(
      `${config.url}/v1/detect?confidence=${confidence}&iou=${iou}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.token}`,
          'content-type': 'image/jpeg',
          'x-request-id': requestId,
        },
        body: image,
        cache: 'no-store',
        signal: AbortSignal.timeout(25_000),
      },
    );

    const responseBody = await upstream.text();
    const headers = {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
      'x-request-id': upstream.headers.get('x-request-id') ?? requestId,
    };

    if (!upstream.ok) {
      return new Response(responseBody, { status: upstream.status, headers });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseBody);
    } catch {
      return NextResponse.json({ error: 'invalid_inference_response' }, { status: 502 });
    }

    const response = publicDetectionResponse(payload);
    if (!response) {
      return NextResponse.json({ error: 'invalid_inference_response' }, { status: 502 });
    }
    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Server inference broker failed', error);
    const code = error instanceof Error ? error.message : 'server_inference_failed';
    return NextResponse.json(
      { error: code },
      { status: code === 'server_inference_not_configured' ? 503 : 502 },
    );
  }
}
