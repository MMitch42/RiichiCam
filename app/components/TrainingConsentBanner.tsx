'use client';

import { useEffect, useState } from 'react';

const C = {
  bg:           '#080c12',
  surface:      '#0f1520',
  surfaceEl:    '#141c28',
  gold:         '#c9a227',
  goldBright:   '#e8c547',
  goldMuted:    'rgba(201,162,39,0.15)',
  goldBorder:   'rgba(201,162,39,0.35)',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
};

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

export default function TrainingConsentBanner({ onAccept, onDecline }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay so the banner slides in after page paint
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        background: C.surface,
        borderTop: `1px solid ${C.goldBorder}`,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
      }}
      role="dialog"
      aria-label="Data contribution consent"
    >
      <div className="max-w-md mx-auto px-4 py-4 space-y-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: C.text }}>
            Help improve RiichiCam
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: C.textSec }}>
            Your scanned tile images can be saved anonymously to train better detection models.
            No personal data is collected — only the tile images you scan.
            You can change this any time in the footer.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-sm text-xs font-bold tracking-widest uppercase transition-colors"
            style={{ background: C.gold, color: C.bg }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.goldBright; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.gold; }}
          >
            Yes, contribute
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 rounded-sm text-xs font-semibold tracking-widest uppercase transition-colors"
            style={{
              background: 'transparent',
              color: C.textSec,
              border: `1px solid rgba(201,162,39,0.2)`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.textSec; }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
