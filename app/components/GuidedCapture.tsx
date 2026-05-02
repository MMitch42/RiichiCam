'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

const C = {
  gold:         '#c9a227',
  goldBright:   '#e8c547',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  bg:           '#080c12',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
  red:          '#cc5544',
};

export type GuidedSection = 'hand' | 'winning' | 'dora';

export interface SectionBox { x: number; y: number; w: number; h: number }

export interface GuidedScanData {
  fullImage: string;
  sections: Partial<Record<GuidedSection, SectionBox>>;
  isLandscape: boolean;
}

interface BoxDef extends SectionBox {
  label: string;
  hint: string;
  color: string;
}

// Fractions of the video frame.
const LANDSCAPE: Record<GuidedSection, BoxDef> = {
  dora:    { x: 0.28, y: 0.07, w: 0.30, h: 0.22, label: 'Dora',    hint: '1–4 tiles',  color: '#98e87e' },
  hand:    { x: 0.02, y: 0.42, w: 0.73, h: 0.34, label: 'Hand',    hint: '13 tiles',   color: C.gold },
  winning: { x: 0.77, y: 0.42, w: 0.18, h: 0.34, label: 'Win',     hint: '1 tile',     color: '#7ec8e3' },
};
const PORTRAIT: Record<GuidedSection, BoxDef> = {
  dora:    { x: 0.03, y: 0.05, w: 0.55, h: 0.13, label: 'Dora',    hint: '1–4 tiles',  color: '#98e87e' },
  hand:    { x: 0.02, y: 0.25, w: 0.96, h: 0.18, label: 'Hand',    hint: '13 tiles',   color: C.gold },
  winning: { x: 0.02, y: 0.48, w: 0.22, h: 0.14, label: 'Win',     hint: '1 tile',     color: '#7ec8e3' },
};

const SECTION_ORDER: GuidedSection[] = ['hand', 'winning', 'dora'];

interface OverlayRect { left: number; top: number; width: number; height: number }

interface GuidedCaptureProps {
  onCapture: (data: GuidedScanData) => void;
  onClose: () => void;
}

export default function GuidedCapture({ onCapture, onClose }: GuidedCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(true);
  const [overlay, setOverlay] = useState<OverlayRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [sections, setSections] = useState<Record<GuidedSection, boolean>>({
    hand: true, winning: true, dora: true,
  });
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const computeOverlay = useCallback(() => {
    const vid = videoRef.current;
    const cont = containerRef.current;
    if (!vid || !cont || !vid.videoWidth) return;
    const cW = cont.clientWidth;
    const cH = cont.clientHeight;
    const vW = vid.videoWidth;
    const vH = vid.videoHeight;
    const scale = Math.min(cW / vW, cH / vH);
    const dW = vW * scale;
    const dH = vH * scale;
    setOverlay({ left: (cW - dW) / 2, top: (cH - dH) / 2, width: dW, height: dH });
    setIsLandscape(vW >= vH);
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          if (caps.torch) setTorchSupported(true);
        }
      })
      .catch(() => setCameraError('Camera access denied. Use Photo Library or Take Photo instead.'));

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(computeOverlay);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [computeOverlay]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch { /* torch unsupported on this device */ }
  }

  function handleVideoReady() {
    setReady(true);
    computeOverlay();
  }

  function capture() {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth) return;

    // Resize to max 1600px (same cap as CameraCapture) to stay under Vercel body limit
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(vid.videoWidth, vid.videoHeight));
    const cW = Math.round(vid.videoWidth * scale);
    const cH = Math.round(vid.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    canvas.getContext('2d')!.drawImage(vid, 0, 0, cW, cH);
    const fullImage = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    const boxes = isLandscape ? LANDSCAPE : PORTRAIT;
    const enabledSections: Partial<Record<GuidedSection, SectionBox>> = {};
    for (const key of SECTION_ORDER) {
      if (sections[key]) {
        const { x, y, w, h } = boxes[key];
        enabledSections[key] = { x, y, w, h };
      }
    }

    onCapture({ fullImage, sections: enabledSections, isLandscape });
  }

  const boxes = isLandscape ? LANDSCAPE : PORTRAIT;
  const anySectionOn = SECTION_ORDER.some((k) => sections[k]);

  return (
    <div className="fixed inset-0 z-50" style={{ background: '#000' }}>
      <div ref={containerRef} className="relative w-full h-full">
        {/* Camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoReady}
          className="w-full h-full"
          style={{ objectFit: 'contain' }}
        />

        {/* Bounding box overlays */}
        {ready && (
          <div
            className="absolute pointer-events-none"
            style={{ left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height }}
          >
            {SECTION_ORDER.map((key) => {
              const box = boxes[key];
              const on = sections[key];
              return (
                <div
                  key={key}
                  style={{
                    position: 'absolute',
                    left:   `${box.x * 100}%`,
                    top:    `${box.y * 100}%`,
                    width:  `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                    border: `2px solid ${on ? box.color : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 4,
                    opacity: on ? 1 : 0.35,
                    transition: 'opacity 0.15s, border-color 0.15s',
                  }}
                >
                  {[
                    { top: -1, left: -1, borderTop: `3px solid ${box.color}`, borderLeft: `3px solid ${box.color}` },
                    { top: -1, right: -1, borderTop: `3px solid ${box.color}`, borderRight: `3px solid ${box.color}` },
                    { bottom: -1, left: -1, borderBottom: `3px solid ${box.color}`, borderLeft: `3px solid ${box.color}` },
                    { bottom: -1, right: -1, borderBottom: `3px solid ${box.color}`, borderRight: `3px solid ${box.color}` },
                  ].map((style, i) => (
                    <div key={i} style={{ position: 'absolute', width: 12, height: 12, ...style }} />
                  ))}
                  <span style={{
                    position: 'absolute',
                    top: -22,
                    left: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: on ? box.color : 'rgba(255,255,255,0.3)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    whiteSpace: 'nowrap',
                  }}>
                    {box.label} <span style={{ opacity: 0.6, fontWeight: 400 }}>{box.hint}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-xs">
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{cameraError}</p>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-sm text-sm font-semibold tracking-wide"
                style={{ background: C.gold, color: C.bg }}
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Landscape hint */}
        {ready && !isLandscape && (
          <div className="absolute top-14 left-0 right-0 flex justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-sm text-xs tracking-wide" style={{ background: 'rgba(8,12,18,0.85)', color: C.gold, border: `1px solid ${C.goldBorderSm}` }}>
              Rotate to landscape for best results
            </span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 pt-6 pb-10 px-6 flex flex-col items-center gap-5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)' }}
      >
        {/* Section toggles */}
        <div className="flex gap-2">
          {SECTION_ORDER.map((key) => {
            const box = boxes[key];
            const on = sections[key];
            return (
              <button
                key={key}
                onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                className="px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest uppercase transition-all"
                style={{
                  border:     `1px solid ${on ? box.color : 'rgba(255,255,255,0.2)'}`,
                  color:      on ? box.color : 'rgba(255,255,255,0.35)',
                  background: on ? `${box.color}1a` : 'transparent',
                }}
              >
                {box.label}
              </button>
            );
          })}
        </div>

        {/* Flash toggle */}
        {torchSupported && (
          <button
            onClick={toggleTorch}
            aria-label={torchOn ? 'Flash on' : 'Flash off'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest uppercase transition-all"
            style={{
              border:     `1px solid ${torchOn ? '#ffe066' : 'rgba(255,255,255,0.2)'}`,
              color:      torchOn ? '#ffe066' : 'rgba(255,255,255,0.45)',
              background: torchOn ? 'rgba(255,224,102,0.12)' : 'transparent',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={torchOn ? '#ffe066' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Flash
          </button>
        )}

        {/* Shutter button */}
        <button
          onClick={capture}
          disabled={!ready || !anySectionOn}
          aria-label="Capture"
          className="flex items-center justify-center rounded-full disabled:opacity-40 transition-transform active:scale-95"
          style={{
            width: 68,
            height: 68,
            background: 'transparent',
            border: '3px solid rgba(255,255,255,0.5)',
          }}
        >
          <div
            className="rounded-full transition-colors"
            style={{ width: 52, height: 52, background: C.gold }}
          />
        </button>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
        style={{ background: 'rgba(8,12,18,0.75)', color: C.text, border: '1px solid rgba(240,234,216,0.15)' }}
        aria-label="Close guided scan"
      >
        ✕
      </button>
    </div>
  );
}
