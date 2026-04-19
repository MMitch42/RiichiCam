'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface CameraCaptureProps {
  label: string;
  onCapture: (base64: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full animate-spin"
      style={{ border: '2px solid #0f1117', borderTopColor: 'transparent' }}
    />
  );
}

const IconPhotoLibrary = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const IconCamera = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconClipboard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

export default function CameraCapture({ label, onCapture, isLoading, disabled }: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1];
        onCapture(base64);
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

  const handlePaste = useCallback(async () => {
    setMenuOpen(false);
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          found = true;
          const blob = await item.getType(imageType);
          processFile(new File([blob], 'paste.png', { type: imageType }));
          break;
        }
      }
      if (!found) showPasteError('No image in clipboard');
    } catch {
      showPasteError('No image in clipboard');
    }
  }, [processFile]);

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
    };
  }, [handleDocumentPaste]);

  const allDisabled = isLoading || !!disabled;

  return (
    <div className="w-full relative">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        onChange={handleLibraryChange}
        className="hidden"
      />

      <button
        onClick={() => setMenuOpen(true)}
        disabled={allDisabled}
        className="w-full py-4 rounded-[10px] text-base font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: '#d4a843', color: '#0f1117' }}
      >
        {isLoading ? <Spinner /> : null}
        <span>{label}</span>
      </button>

      {pasteError && (
        <p className="mt-2 text-sm text-center" style={{ color: '#e05252' }}>{pasteError}</p>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

          <div
            className="absolute top-full left-0 right-0 mt-2 z-50 rounded-[10px] overflow-hidden"
            style={{
              background: '#1a1d27',
              border: '1px solid #2a2d3a',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              animation: 'menuIn 0.15s ease',
            }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                setTimeout(() => libraryInputRef.current?.click(), 50);
              }}
              className="w-full flex items-center gap-3 px-5 transition-colors"
              style={{ minHeight: 48, borderBottom: '1px solid #2a2d3a', color: '#f5f0e8' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#222536')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#8b8fa8' }}><IconPhotoLibrary /></span>
              <span className="text-sm font-medium">Photo Library</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setTimeout(() => cameraInputRef.current?.click(), 50);
              }}
              className="w-full flex items-center gap-3 px-5 transition-colors"
              style={{ minHeight: 48, borderBottom: '1px solid #2a2d3a', color: '#f5f0e8' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#222536')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#8b8fa8' }}><IconCamera /></span>
              <span className="text-sm font-medium">Take Photo</span>
            </button>
            <button
              onClick={handlePaste}
              className="w-full flex items-center gap-3 px-5 transition-colors"
              style={{ minHeight: 48, color: '#f5f0e8' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#222536')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#8b8fa8' }}><IconClipboard /></span>
              <span className="text-sm font-medium">Paste from Clipboard</span>
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes menuIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
