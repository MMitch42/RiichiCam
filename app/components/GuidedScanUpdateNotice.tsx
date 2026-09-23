'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Change this identifier for each release announcement. A browser sees each
// announcement version once, independently of PWA/service-worker updates.
const ANNOUNCEMENT_ID = 'guided-scan-v12-server-model-v2';
const STORAGE_KEY = `riichicam-announcement:${ANNOUNCEMENT_ID}`;

const C = {
  bg: '#080c12',
  surface: '#0f1520',
  surfaceEl: '#141c28',
  gold: '#c9a227',
  goldBright: '#e8c547',
  goldBorder: 'rgba(201,162,39,0.35)',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  text: '#f0ead8',
  textSec: '#8a7f6a',
};

export default function GuidedScanUpdateNotice() {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // Private browsing can deny local storage; showing the notice again is
      // preferable to making the scorer unusable.
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* see above */ }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(8,12,18,0.82)' }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-scan-update-title"
        className="w-full max-w-sm rounded-sm overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.goldBorder}`, boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
      >
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.goldBorderSm}` }}>
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="flex-shrink-0 flex items-center justify-center rounded-sm"
              style={{ width: 38, height: 44, background: C.surfaceEl, border: `1px solid ${C.goldBorder}` }}
            >
              <Image src="/icon.svg" alt="" width={30} height={30} priority />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: C.gold, letterSpacing: '0.08em' }}>GUIDED SCAN UPDATE</p>
              <h2 id="guided-scan-update-title" className="mt-1 text-lg font-semibold" style={{ color: C.text }}>
                A sharper way to scan
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.textSec }}>
                Guided Scan has a new detector. Try it out and let us know how it does!
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end">
          <button
            ref={closeButton}
            onClick={dismiss}
            className="rounded-sm text-sm font-semibold"
            style={{ background: C.goldBright, color: C.bg, padding: '9px 13px' }}
          >
            Dismiss
          </button>
        </div>
      </section>
    </div>
  );
}
