'use client';

import { useEffect, useState } from 'react';

const C = {
  surface:    '#0f1520',
  gold:       '#c9a227',
  goldBorder: 'rgba(201,162,39,0.35)',
  text:       '#f0ead8',
  textSec:    '#8a7f6a',
  bg:         '#080c12',
};

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
}

function isMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export default function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!isMobile()) return;
    if (isInStandaloneMode()) return;
    if (localStorage.getItem('pwaBannerDismissed')) return;
    setIos(isIOS());
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem('pwaBannerDismissed', '1');
    setShow(false);
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: C.surface,
        borderBottom: `1px solid ${C.goldBorder}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-sm"
          style={{ width: 36, height: 36, background: C.bg, border: `1px solid ${C.goldBorder}` }}
        >
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="3" width="24" height="26" rx="2" fill={C.bg} stroke={C.gold} strokeWidth="1.5"/>
            <text x="16" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill={C.gold} fontFamily="serif">中</text>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: C.text }}>Add RiichiCam to your home screen</p>
          <p className="text-xs mt-0.5" style={{ color: C.textSec }}>
            {ios
              ? 'Tap the share button ↑ then "Add to Home Screen"'
              : 'Tap your browser menu → "Add to Home Screen"'}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-sm transition-colors"
          style={{ color: C.textSec, background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.textSec; }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
