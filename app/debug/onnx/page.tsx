'use client';

import { useEffect, useRef, useState } from 'react';
import { detectTiles, preferredBackend } from '@/lib/detection/onnx-detector';
import type { RawPrediction } from '@/lib/scoring/roboflow-parser';

const DEFAULT_MODEL_URL = '/models/tile-detector.onnx';

interface BackendResult {
  predictions: RawPrediction[];
  ms: number;
  error?: string;
}

interface ImageItem {
  id: string;
  name: string;
  img: HTMLImageElement;
  onnx?: BackendResult;
  roboflow?: BackendResult;
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runRoboflow(file: File): Promise<BackendResult> {
  const t0 = performance.now();
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      mode: 'hand',
      save: false,
      sessionId: 'onnx-debug',
      returnRawPredictions: true,
    }),
  });
  const data = await res.json();
  const ms = performance.now() - t0;
  if (data.error) return { predictions: [], ms, error: data.error };
  return { predictions: data.rawPredictions ?? [], ms };
}

async function runOnnx(
  modelUrl: string,
  img: HTMLImageElement,
  confidenceThreshold: number,
  iouThreshold: number,
): Promise<BackendResult> {
  const t0 = performance.now();
  try {
    const predictions = await detectTiles(
      modelUrl,
      img,
      img.naturalWidth,
      img.naturalHeight,
      { confidenceThreshold, iouThreshold },
    );
    return { predictions, ms: performance.now() - t0 };
  } catch (err) {
    return {
      predictions: [],
      ms: performance.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function BoxCanvas({
  img,
  predictions,
  color,
}: {
  img: HTMLImageElement;
  predictions: RawPrediction[];
  color: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const maxWidth = 420;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'top';
    for (const pred of predictions) {
      const x = (pred.x - pred.width / 2) * scale;
      const y = (pred.y - pred.height / 2) * scale;
      const w = pred.width * scale;
      const h = pred.height * scale;
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, w, h);
      const label = `${pred.class} ${(pred.confidence * 100).toFixed(0)}%`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y - 14), textWidth + 4, 14);
      ctx.fillStyle = '#000';
      ctx.fillText(label, x + 2, Math.max(0, y - 13));
    }
  }, [img, predictions, color]);

  return <canvas ref={ref} style={{ maxWidth: '100%', borderRadius: 8 }} />;
}

function ResultPanel({ title, result }: { title: string; result?: BackendResult }) {
  if (!result) return <p style={{ opacity: 0.6 }}>{title}: —</p>;
  if (result.error) {
    return (
      <p style={{ color: '#f66' }}>
        {title} error ({result.ms.toFixed(0)}ms): {result.error}
      </p>
    );
  }
  return (
    <div>
      <p>
        {title}: {result.predictions.length} tiles in {result.ms.toFixed(0)}ms
      </p>
      <p style={{ fontSize: 12, opacity: 0.8 }}>
        {result.predictions
          .map((p) => `${p.class}(${(p.confidence * 100).toFixed(0)}%)`)
          .join(', ') || '(none)'}
      </p>
    </div>
  );
}

export default function OnnxDebugPage() {
  const [modelUrl, setModelUrl] = useState(DEFAULT_MODEL_URL);
  const [compareRoboflow, setCompareRoboflow] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.45);
  const [iouThreshold, setIouThreshold] = useState(0.5);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [busy, setBusy] = useState(false);
  // navigator.gpu doesn't exist during SSR, so this is resolved client-side
  // after mount rather than read directly in the render body — reading it
  // inline would render "wasm" on the server and "webgpu" on the client,
  // which is a hydration mismatch.
  const [backend, setBackend] = useState<string | null>(null);
  useEffect(() => setBackend(preferredBackend()), []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    const files = Array.from(fileList);
    for (const file of files) {
      const img = await fileToImage(file);
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      const item: ImageItem = { id, name: file.name, img };
      setItems((prev) => [...prev, item]);

      const [onnx, roboflow] = await Promise.all([
        runOnnx(modelUrl, img, confidenceThreshold, iouThreshold),
        compareRoboflow ? runRoboflow(file) : Promise.resolve(undefined),
      ]);

      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, onnx, roboflow } : it)),
      );
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>ONNX detector debug harness</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Not linked from the app; internal testing only. Preferred backend for this
        device: <strong>{backend ?? '…'}</strong>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
        <label style={{ fontSize: 13 }}>
          Model URL{' '}
          <input
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            style={{ width: 280 }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          Confidence threshold {confidenceThreshold.toFixed(2)}{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          IoU threshold {iouThreshold.toFixed(2)}{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={iouThreshold}
            onChange={(e) => setIouThreshold(Number(e.target.value))}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={compareRoboflow}
            onChange={(e) => setCompareRoboflow(e.target.checked)}
          />{' '}
          Compare against Roboflow (uses your live /api/detect)
        </label>
      </div>

      <input
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {busy && <p>Running…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
        {items.map((item) => (
          <div key={item.id} style={{ borderTop: '1px solid #444', paddingTop: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 12, color: '#4ad' }}>ONNX (blue)</p>
                <BoxCanvas img={item.img} predictions={item.onnx?.predictions ?? []} color="#4ad" />
                <ResultPanel title="ONNX" result={item.onnx} />
              </div>
              {compareRoboflow && (
                <div>
                  <p style={{ fontSize: 12, color: '#fa4' }}>Roboflow (orange)</p>
                  <BoxCanvas
                    img={item.img}
                    predictions={item.roboflow?.predictions ?? []}
                    color="#fa4"
                  />
                  <ResultPanel title="Roboflow" result={item.roboflow} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
