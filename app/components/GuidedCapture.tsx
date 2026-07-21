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
// The capture payload can also carry a derived 'meld' box (the right slice of
// the hand box, cut at the open/closed divider) - it isn't one of the static
// overlay boxes/toggles, so it's a wider type than GuidedSection.
export type CaptureSection = GuidedSection | 'meld';

export interface SectionBox { x: number; y: number; w: number; h: number }

export interface GuidedScanData {
  fullImage: string;
  sections: Partial<Record<CaptureSection, SectionBox>>;
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
// Thin-wide rectangles for Hand (tiles sit in a row).
// Dora is ~60% the width of the frame. Winning tile is a small box.
// Dora + Win share a top strip; Hand sits below as a long thin row.
// All landscape y-coords are chosen so every box stays within the visible
// viewport on 20:9 Android screens (cover-scale clips ~14% from top & bottom).
// Rule of thumb: y_min_safe ≈ 0.14 + desired_margin_fraction.
const LANDSCAPE: Record<GuidedSection, BoxDef> = {
  dora:    { x: 0.04, y: 0.22, w: 0.60, h: 0.20, label: 'Dora / Ura Dora', shortLabel: 'Dora', hint: '1–8 tiles', color: '#98e87e' },
  hand:    { x: 0.02, y: 0.47, w: 0.72, h: 0.28, label: 'Hand',             shortLabel: 'Hand', hint: '13 tiles', color: C.gold },
  winning: { x: 0.76, y: 0.47, w: 0.19, h: 0.28, label: 'Win',              shortLabel: 'Win',  hint: '1 tile',   color: '#7ec8e3' },
};
const PORTRAIT: Record<GuidedSection, BoxDef> = {
  dora:    { x: 0.02, y: 0.04, w: 0.96, h: 0.14, label: 'Dora / Ura Dora', shortLabel: 'Dora', hint: '1–8 tiles', color: '#98e87e' },
  hand:    { x: 0.02, y: 0.25, w: 0.96, h: 0.18, label: 'Hand',             shortLabel: 'Hand', hint: '13 tiles', color: C.gold },
  winning: { x: 0.02, y: 0.48, w: 0.22, h: 0.14, label: 'Win',              shortLabel: 'Win',  hint: '1 tile',   color: '#7ec8e3' },
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

  // ── Open hand (called melds) ────────────────────────────────────────────────
  // When on, a draggable divider splits the Hand box into a concealed (left)
  // and a called-melds (right) region. On capture the right slice is sent as a
  // separate 'meld' box so detection can group those tiles into pon/chi/kan.
  const [openHand, setOpenHand] = useState(false);
  const [dividerFrac, setDividerFrac] = useState(0.7); // fraction of hand-box width
  const handBoxRef = useRef<HTMLDivElement>(null);
  const draggingDivider = useRef(false);

  // ── Zoom ──────────────────────────────────────────────────────────────────────
  // zoomRef / hardwareZoomRef / zoomMaxRef mirror state but are readable inside
  // the non-passive touchmove handler without stale-closure issues.
  const [zoom, setZoom] = useState(1);
  const [zoomMax, setZoomMax] = useState(5);
  const [hardwareZoom, setHardwareZoom] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const hardwareZoomRef = useRef(false);
  const zoomMaxRef = useRef(5);
  const pinchRef = useRef<{ dist: number; baseZoom: number } | null>(null);
  const lastTapRef = useRef(0);

  const computeOverlay = useCallback(() => {
    const vid = videoRef.current;
    const cont = containerRef.current;
    if (!vid || !cont || !vid.videoWidth) return;
    const cW = cont.clientWidth;
    const cH = cont.clientHeight;
    const vW = vid.videoWidth;
    const vH = vid.videoHeight;
    // Use cover scaling (Math.max) so the video fills the container on every
    // screen ratio - no pillarboxing on wide Android screens. The overlay div
    // will extend beyond the container edges; the container's overflow:hidden
    // clips it cleanly. Section bounding boxes are fractions of the full video
    // frame, so API-side coordinate math is unaffected by display clipping.
    const scale = Math.max(cW / vW, cH / vH);
    const dW = vW * scale;
    const dH = vH * scale;
    setOverlay({ left: (cW - dW) / 2, top: (cH - dH) / 2, width: dW, height: dH });
    setIsLandscape(vW >= vH);
  }, []);

  // Lock body scroll while overlay is open. We intentionally avoid position:fixed on
  // the body - on iOS Safari, fixed children of a fixed body are offset by the body's
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
          const caps = track.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
            zoom?: { min: number; max: number; step?: number };
          };
          if (caps.torch) setTorchSupported(true);
          if (caps.zoom) {
            hardwareZoomRef.current = true;
            setHardwareZoom(true);
            const max = Math.min(caps.zoom.max ?? 5, 10);
            zoomMaxRef.current = max;
            setZoomMax(max);
          }
        }
      })
      .catch(() => setCameraError('Camera access denied. Use Photo Library or Take Photo instead.'));

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Non-passive touchmove so we can preventDefault during pinch (prevents page scroll).
  // All values are read from refs to avoid stale closures.
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const raw = pinchRef.current.baseZoom * (dist / pinchRef.current.dist);
      const clamped = Math.max(1, Math.min(zoomMaxRef.current, raw));
      zoomRef.current = clamped;
      setZoom(clamped);
      if (hardwareZoomRef.current) {
        const track = streamRef.current?.getVideoTracks()[0];
        if (track) {
          track.applyConstraints({ advanced: [{ zoom: clamped } as MediaTrackConstraintSet] }).catch(() => {});
        }
      }
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []); // stable - reads only refs

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

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), baseZoom: zoomRef.current };
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
    // Double-tap resets zoom to 1×
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        const newZoom = 1;
        zoomRef.current = newZoom;
        setZoom(newZoom);
        if (hardwareZoomRef.current) {
          const track = streamRef.current?.getVideoTracks()[0];
          if (track) {
            track.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] }).catch(() => {});
          }
        }
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  }

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

  // Divider drag. Pointer events (not touch) so mouse + touch share one path;
  // stopPropagation keeps the drag from triggering the hand-box toggle onClick
  // or the outer pinch-zoom handler.
  function onDividerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    draggingDivider.current = true;
  }
  function onDividerMove(e: React.PointerEvent) {
    if (!draggingDivider.current) return;
    e.stopPropagation();
    const rect = handBoxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = (e.clientX - rect.left) / rect.width;
    setDividerFrac(Math.max(0.25, Math.min(0.9, frac)));
  }
  function onDividerUp(e: React.PointerEvent) {
    e.stopPropagation();
    draggingDivider.current = false;
  }

  function capture() {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth) return;

    // Allow up to 2048px so 1080p footage isn't downscaled - still well under Vercel's 4.5 MB body limit.
    const MAX = 2048;
    const scale = Math.min(1, MAX / Math.max(vid.videoWidth, vid.videoHeight));
    const cW = Math.round(vid.videoWidth * scale);
    const cH = Math.round(vid.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d')!;
    // Mild contrast + brightness boost - significantly helps tile edge detection without
    // retraining the model. ctx.filter silently no-ops on browsers that don't support it.
    ctx.filter = 'contrast(1.15) brightness(1.05)';
    ctx.drawImage(vid, 0, 0, cW, cH);
    ctx.filter = 'none';
    const fullImage = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];

    const boxes = isLandscape ? LANDSCAPE : PORTRAIT;
    const enabledSections: Partial<Record<CaptureSection, SectionBox>> = {};
    for (const key of SECTION_ORDER) {
      if (sections[key]) {
        const { x, y, w, h } = boxes[key];
        enabledSections[key] = { x, y, w, h };
      }
    }

    // Open hand: cut the hand box at the divider into concealed (left) + melds
    // (right). A dead zone straddles the divider so detection's per-box padding
    // (±2% of frame) can't place a tile in BOTH regions and double-count it -
    // the user aligns the divider to the physical gap between their concealed
    // hand and their called melds, so no real tile should sit in the dead zone.
    if (openHand && enabledSections.hand) {
      const hb = boxes.hand;
      const splitX = hb.x + hb.w * dividerFrac;
      const dead = hb.w * 0.08; // > 2x PAD(0.02 frame) once scaled by hand width
      enabledSections.hand = { x: hb.x, y: hb.y, w: (splitX - dead / 2) - hb.x, h: hb.h };
      enabledSections.meld = { x: splitX + dead / 2, y: hb.y, w: (hb.x + hb.w) - (splitX + dead / 2), h: hb.h };
    }

    onCapture({ fullImage, sections: enabledSections, isLandscape });
  }

  const boxes = isLandscape ? LANDSCAPE : PORTRAIT;
  const anySectionOn = SECTION_ORDER.some((k) => sections[k]);

  // "Open" toggle button (called-melds divider). Styled like the section
  // toggles but in the "called" red; disabled unless the Hand section is on,
  // since the divider lives inside the hand box.
  const renderOpenToggle = (minWidth: number) => (
    <button
      onClick={() => setOpenHand((v) => !v)}
      disabled={!sections.hand}
      className="flex flex-col items-center gap-1 px-3 py-2 rounded transition-all disabled:opacity-40"
      style={{
        border:     `1.5px solid ${openHand ? C.red : 'rgba(255,255,255,0.18)'}`,
        color:      openHand ? C.red : 'rgba(255,255,255,0.3)',
        background: openHand ? `${C.red}22` : 'rgba(0,0,0,0.35)',
        minWidth,
      }}
    >
      <span className="text-xs font-bold tracking-widest uppercase">Open</span>
      <span
        className="text-xs font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
        style={{
          background: openHand ? C.red : 'rgba(255,255,255,0.08)',
          color: openHand ? '#000' : 'rgba(255,255,255,0.3)',
          fontSize: 9,
        }}
      >
        {openHand ? 'ON' : 'OFF'}
      </span>
    </button>
  );

  return (
    <div
      ref={outerRef}
      className="fixed inset-0 z-50"
      style={{ background: '#000' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* overflow:hidden clips the overlay div when it extends beyond the screen
          (which happens with cover-scale on ultra-wide Android landscape screens). */}
      <div ref={containerRef} className="relative w-full h-full" style={{ overflow: 'hidden' }}>
        {/* Camera feed - cover fills the screen; no pillarboxing on 20:9 Android phones */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoReady}
          className="w-full h-full"
          style={{ objectFit: 'cover' }}
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
                  ref={key === 'hand' ? handBoxRef : undefined}
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
                  {/* Label sits inside the top-left of the box so it's never
                      clipped off-screen when cover-scale shifts the overlay up */}
                  <span style={{
                    position: 'absolute',
                    top: 5,
                    left: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: on ? box.color : 'rgba(255,255,255,0.3)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    whiteSpace: 'nowrap',
                  }}>
                    {box.label} <span style={{ opacity: 0.6, fontWeight: 400 }}>{box.hint}</span>
                  </span>

                  {/* Open-hand divider: only in the hand box, when enabled. */}
                  {key === 'hand' && openHand && on && (
                    <>
                      {/* "Called" tint on the right slice */}
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${dividerFrac * 100}%`, right: 0,
                        background: `${C.red}22`, pointerEvents: 'none',
                      }} />
                      {/* "Called" label, top-right */}
                      <span style={{
                        position: 'absolute', top: 5, right: 6,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
                        textTransform: 'uppercase', color: C.red,
                        textShadow: '0 1px 4px rgba(0,0,0,0.9)', whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}>
                        Called
                      </span>
                      {/* Draggable divider line + grab handle */}
                      <div
                        onPointerDown={onDividerDown}
                        onPointerMove={onDividerMove}
                        onPointerUp={onDividerUp}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute', top: -8, bottom: -8,
                          left: `${dividerFrac * 100}%`,
                          width: 32, transform: 'translateX(-16px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'ew-resize', touchAction: 'none', pointerEvents: 'auto',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 0, bottom: 0, width: 3, background: C.red, borderRadius: 2 }} />
                        <div style={{
                          width: 18, height: 28, borderRadius: 4, background: C.red,
                          border: '2px solid rgba(255,255,255,0.85)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Zoom indicator - only on devices with hardware zoom */}
        {ready && hardwareZoom && (
          <div
            className="absolute pointer-events-none flex items-center gap-1.5"
            style={{
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.55)',
              color: zoom > 1.05 ? '#fff' : 'rgba(255,255,255,0.45)',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 10px',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              border: zoom > 1.05 ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {zoom.toFixed(1)}×
            {zoom > 1.05 && (
              <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 10 }}>double-tap to reset</span>
            )}
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
          <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: 'calc(56px + env(safe-area-inset-top))' }}>
            <span className="px-3 py-1.5 rounded-sm text-xs tracking-wide" style={{ background: 'rgba(8,12,18,0.85)', color: C.gold, border: `1px solid ${C.goldBorderSm}` }}>
              Rotate to landscape for best results
            </span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)',
          paddingTop: isLandscape ? 12 : 24,
          // env(safe-area-inset-bottom) covers the iOS home indicator and Android gesture bar
          paddingBottom: `max(${isLandscape ? 12 : 40}px, calc(${isLandscape ? 12 : 40}px + env(safe-area-inset-bottom)))`,
        }}
      >
        {isLandscape ? (
          /* Landscape: flash | shutter | toggles - all in one row */
          <div className="flex items-center w-full">
            {/* Flash - left side, flex-1 so it's equidistant from shutter as Hand toggle */}
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

            {/* Shutter - center */}
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

            {/* Section toggles - right side, flex-1 so Hand toggle is equidistant from shutter as flash */}
            <div className="flex flex-1 justify-start pl-6">
            <div className="flex gap-2">
              {renderOpenToggle(64)}
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
                {renderOpenToggle(72)}
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
        className="absolute w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
        style={{
          top: 'calc(16px + env(safe-area-inset-top))',
          right: 'calc(16px + env(safe-area-inset-right))',
          background: 'rgba(8,12,18,0.75)',
          color: C.text,
          border: '1px solid rgba(240,234,216,0.15)',
        }}
        aria-label="Close guided scan"
      >
        ✕
      </button>
    </div>
  );
}
