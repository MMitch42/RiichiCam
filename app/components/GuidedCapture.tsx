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

export type GuidedSection = 'hand' | 'winning' | 'dora' | 'melds';

export interface SectionBox { x: number; y: number; w: number; h: number }

export interface GuidedScanData {
  fullImage: string;
  sections: Partial<Record<GuidedSection, SectionBox>>;
  isLandscape: boolean;
}

interface BoxDef extends SectionBox {
  label: string;
  shortLabel: string; // used on toggle buttons (single word, fits small button)
  hint: string;
  color: string;
}

// Fractions of the video frame.
//
// Both orientations use thin-wide rectangles for Hand and Melds (tiles sit in a row).
// Dora is ~half the width of Hand. Winning tile is a small square.
// Hand + Melds are stacked rows; Dora + Win share the top strip.
const LANDSCAPE: Record<GuidedSection, BoxDef> = {
  dora:    { x: 0.02, y: 0.05, w: 0.60, h: 0.18, label: 'Dora / Ura Dora', shortLabel: 'Dora',  hint: '1–8 tiles',         color: '#98e87e' },
  winning: { x: 0.66, y: 0.04, w: 0.14, h: 0.20, label: 'Win',              shortLabel: 'Win',   hint: '1 tile',            color: '#7ec8e3' },
  hand:    { x: 0.02, y: 0.30, w: 0.94, h: 0.21, label: 'Hand',             shortLabel: 'Hand',  hint: 'closed tiles only', color: C.gold },
  melds:   { x: 0.02, y: 0.58, w: 0.94, h: 0.21, label: 'Chi / Pon / Kan',  shortLabel: 'Melds', hint: 'open tiles',        color: '#ff6633' },
};
const PORTRAIT: Record<GuidedSection, BoxDef> = {
  dora:    { x: 0.02, y: 0.04, w: 0.72, h: 0.14, label: 'Dora / Ura Dora', shortLabel: 'Dora',  hint: '1–8 tiles',         color: '#98e87e' },
  winning: { x: 0.78, y: 0.04, w: 0.14, h: 0.14, label: 'Win',              shortLabel: 'Win',   hint: '1 tile',            color: '#7ec8e3' },
  hand:    { x: 0.02, y: 0.22, w: 0.94, h: 0.20, label: 'Hand',             shortLabel: 'Hand',  hint: 'closed tiles only', color: C.gold },
  melds:   { x: 0.02, y: 0.46, w: 0.94, h: 0.20, label: 'Chi / Pon / Kan',  shortLabel: 'Melds', hint: 'open tiles',        color: '#ff6633' },
};

const SECTION_ORDER: GuidedSection[] = ['hand', 'winning', 'dora', 'melds'];

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
    hand: true, winning: true, dora: true, melds: false,
  });
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const computeOverlay = useCallback(() => {
    const vid = videoRef.current;
    const cont = containerRef.current;
    if (!vid || !cont || !vid.videoWidth) return;
    // Use the container's actual rendered dimensions. With viewport-fit:cover and
    // top:env(safe-area-inset-top) on the outer div, the container is already
    // correctly sized to the usable area in both browser and PWA modes.
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

  // Lock body scroll while overlay is open. We intentionally avoid position:fixed on
  // the body — on iOS Safari, fixed children of a fixed body are offset by the body's
  // top value, producing a permanent black gap at the top of the camera view.
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevOverscroll   = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow            = 'hidden';
    document.body.style.overscrollBehavior  = 'none';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow            = prevBodyOverflow;
      document.body.style.overscrollBehavior  = prevOverscroll;
    };
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

  // On rotation the camera stream updates before the DOM layout settles, so
  // we schedule two retries: one quick pass and one after iOS finishes
  // the rotation animation, to ensure the container has its final dimensions.
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const handleOrientationChange = () => {
      t1 = setTimeout(computeOverlay, 150);
      t2 = setTimeout(computeOverlay, 450);
    };
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [computeOverlay]);

  // Re-compute when the video's intrinsic dimensions change (e.g. device rotates
  // and the camera stream switches from portrait ↔ landscape).
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.addEventListener('resize', computeOverlay);
    return () => vid.removeEventListener('resize', computeOverlay);
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
    <div className="fixed z-50" style={{ top: 'env(safe-area-inset-top)', left: 0, right: 0, bottom: 0, background: '#000' }}>
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
                  onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                  style={{
                    position: 'absolute',
                    left:   `${box.x * 100}%`,
                    top:    `${box.y * 100}%`,
                    width:  `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                    border: `3px solid ${on ? box.color : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 4,
                    opacity: on ? 1 : 0.35,
                    transition: 'opacity 0.15s, border-color 0.15s',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  {(() => {
                    const c = on ? box.color : 'rgba(255,255,255,0.15)';
                    return [
                      { top: -1, left: -1,  borderTop: `4px solid ${c}`, borderLeft: `4px solid ${c}` },
                      { top: -1, right: -1, borderTop: `4px solid ${c}`, borderRight: `4px solid ${c}` },
                      { bottom: -1, left: -1,  borderBottom: `4px solid ${c}`, borderLeft: `4px solid ${c}` },
                      { bottom: -1, right: -1, borderBottom: `4px solid ${c}`, borderRight: `4px solid ${c}` },
                    ].map((style, i) => (
                      <div key={i} style={{ position: 'absolute', width: 12, height: 12, ...style }} />
                    ));
                  })()}
                  <span style={{
                    position: 'absolute',
                    top: -24,
                    left: 0,
                    fontSize: 12,
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
        className="absolute bottom-0 left-0 right-0 px-6"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)', paddingTop: isLandscape ? 12 : 24, paddingBottom: isLandscape ? 12 : 40 }}
      >
        {isLandscape ? (
          /* Landscape: flash | shutter | toggles — all in one row */
          <div className="flex items-center w-full">
            {/* Flash — left side, flex-1 so it's equidistant from shutter as Hand toggle */}
            <div className="flex flex-1 justify-end pr-6">
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
            </div>

            {/* Shutter — center */}
            <button
              onClick={capture}
              disabled={!ready || !anySectionOn}
              aria-label="Capture"
              className="flex items-center justify-center rounded-full disabled:opacity-40 transition-transform active:scale-95 shrink-0"
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

            {/* Section toggles — right side, flex-1 so Hand toggle is equidistant from shutter as flash */}
            <div className="flex flex-1 justify-start pl-6">
            <div className="flex gap-2">
              {SECTION_ORDER.map((key) => {
                const box = boxes[key];
                const on = sections[key];
                return (
                  <button
                    key={key}
                    onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded transition-all"
                    style={{
                      border:     `1.5px solid ${on ? box.color : 'rgba(255,255,255,0.18)'}`,
                      color:      on ? box.color : 'rgba(255,255,255,0.3)',
                      background: on ? `${box.color}22` : 'rgba(0,0,0,0.35)',
                      minWidth: 64,
                    }}
                  >
                    <span className="text-xs font-bold tracking-widest uppercase">{box.shortLabel}</span>
                    <span
                      className="text-xs font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
                      style={{
                        background: on ? box.color : 'rgba(255,255,255,0.08)',
                        color: on ? '#000' : 'rgba(255,255,255,0.3)',
                        fontSize: 9,
                      }}
                    >
                      {on ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        ) : (
          /* Portrait: stacked layout */
          <div className="flex flex-col items-center gap-5">
            {/* Section toggles */}
            <div className="w-full px-2">
              <p className="text-center text-xs mb-2 tracking-wider font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tap to enable / disable sections
              </p>
              <div className="flex gap-2 justify-center">
                {SECTION_ORDER.map((key) => {
                  const box = boxes[key];
                  const on = sections[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                      className="flex flex-col items-center gap-1 px-3 py-2 rounded transition-all"
                      style={{
                        border:     `1.5px solid ${on ? box.color : 'rgba(255,255,255,0.18)'}`,
                        color:      on ? box.color : 'rgba(255,255,255,0.3)',
                        background: on ? `${box.color}22` : 'rgba(0,0,0,0.35)',
                        minWidth: 72,
                      }}
                    >
                      <span className="text-xs font-bold tracking-widest uppercase">{box.shortLabel}</span>
                      <span
                        className="text-xs font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
                        style={{
                          background: on ? box.color : 'rgba(255,255,255,0.08)',
                          color: on ? '#000' : 'rgba(255,255,255,0.3)',
                          fontSize: 9,
                        }}
                      >
                        {on ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
              </div>
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
        )}
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
