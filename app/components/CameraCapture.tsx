'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface CameraCaptureProps {
  label: string;
  onCapture: (base64: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  onStartGuided?: () => void;
}

const C = {
  bg:           '#080c12',
  surface:      '#0f1520',
  surfaceEl:    '#141c28',
  gold:         '#c9a227',
  goldBright:   '#e8c547',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  goldHover:    'rgba(201,162,39,0.08)',
  goldMenuBdr:  'rgba(201,162,39,0.3)',
  goldMenuDiv:  'rgba(201,162,39,0.1)',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
  red:          '#cc5544',
};

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full animate-spin flex-shrink-0"
      style={{ border: `2px solid ${C.bg}`, borderTopColor: 'transparent' }}
    />
  );
}

const IconPhotoLibrary = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconGuided = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="6" x2="6" y2="18" />
    <line x1="18" y1="6" x2="18" y2="18" />
    <rect x="14" y="8" width="3" height="8" rx="1" strokeWidth="1.2" />
  </svg>
);

const IconClipboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

export default function CameraCapture({ label, onCapture, isLoading, disabled, onStartGuided }: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          onCapture(base64);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [onCapture],
  );

  function showPasteError(msg: string) {
    setPasteError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setPasteError(null), 3000);
  }

  function showPasteHint(msg: string) {
    setPasteHint(msg);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setPasteHint(null), 4000);
  }

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile],
  );

  const handleLibraryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile],
  );

  const handlePaste = useCallback(() => {
    setMenuOpen(false);
    showPasteHint('Press ⌘V (Mac) or Ctrl+V (Windows) to paste an image');
  }, []);

  const handleDocumentPaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) processFile(file);
          return;
        }
      }
    },
    [processFile],
  );

  useEffect(() => {
    document.addEventListener('paste', handleDocumentPaste);
    return () => {
      document.removeEventListener('paste', handleDocumentPaste);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [handleDocumentPaste]);

  const allDisabled = isLoading || !!disabled;

  return (
    <div className="w-full relative">
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraChange} className="hidden" />
      <input ref={libraryInputRef} type="file" accept="image/*" onChange={handleLibraryChange} className="hidden" />

      <button
        onClick={() => setMenuOpen(true)}
        disabled={allDisabled}
        className="w-full py-3 rounded-sm text-sm font-semibold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: C.gold, color: C.bg }}
        onMouseEnter={(e) => { if (!allDisabled) e.currentTarget.style.background = C.goldBright; }}
        onMouseLeave={(e) => { if (!allDisabled) e.currentTarget.style.background = C.gold; }}
      >
        {isLoading ? <Spinner /> : null}
        <span>{label}</span>
      </button>

      {pasteError && (
        <p className="mt-2 text-xs text-center" style={{ color: C.red }}>{pasteError}</p>
      )}
      {pasteHint && (
        <p className="mt-2 text-xs text-center" style={{ color: C.text }}>{pasteHint}</p>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

          <div
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-sm overflow-hidden"
            style={{
              background: C.surfaceEl,
              border: `1px solid ${C.goldMenuBdr}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              animation: 'menuIn 0.12s ease',
            }}
          >
            {onStartGuided && (
              <button
                onClick={() => { setMenuOpen(false); onStartGuided(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-sm"
                style={{ borderBottom: `1px solid ${C.goldMenuDiv}`, color: C.text }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.goldHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: C.textSec }}><IconGuided /></span>
                <div>
                  <div>Guided Scan</div>
                  <div className="text-xs mt-0.5" style={{ color: C.textSec }}>Hand · Winning · Dora in one shot</div>
                </div>
              </button>
            )}
            <button
              onClick={() => { setMenuOpen(false); setTimeout(() => libraryInputRef.current?.click(), 50); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-sm"
              style={{ borderBottom: `1px solid ${C.goldMenuDiv}`, color: C.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: C.textSec }}><IconPhotoLibrary /></span>
              <span>Photo Library</span>
            </button>
            <button
              onClick={() => { setMenuOpen(false); setTimeout(() => cameraInputRef.current?.click(), 50); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-sm"
              style={{ borderBottom: `1px solid ${C.goldMenuDiv}`, color: C.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: C.textSec }}><IconCamera /></span>
              <span>Take Photo</span>
            </button>
            <button
              onClick={handlePaste}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-sm"
              style={{ color: C.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.goldHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: C.textSec }}><IconClipboard /></span>
              <span>Paste from Clipboard</span>
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes menuIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
