'use client';

import { useEffect, useRef, useState } from 'react';

const C = {
  surface:    '#0f1520',
  gold:       '#c9a227',
  goldBright: '#e8c547',
  goldBorder: 'rgba(201,162,39,0.35)',
  text:       '#f0ead8',
  textSec:    '#8a7f6a',
  bg:         '#080c12',
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

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
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isMobile()) return;
    if (isInStandaloneMode()) return;
    if (localStorage.getItem('pwaBannerDismissed')) return;
    setIos(isIOS());
    setShow(true);
  }, []);

  useEffect(() => {
    // Chrome/Edge/Samsung Internet fire this instead of showing their own
    // install UI, letting us trigger the native install flow from our own
    // button - preventDefault() suppresses their mini-infobar so we're the
    // only prompt the user sees. Safari/iOS never fires this (no API
    // support there), so those users keep the manual share-sheet steps.
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
    }
    // Covers installing via the browser's own menu while our banner is still
    // showing, not just installs triggered through our button.
    function onAppInstalled() {
      localStorage.setItem('pwaBannerDismissed', '1');
      deferredPrompt.current = null;
      setCanPromptInstall(false);
      setShow(false);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem('pwaBannerDismissed', '1');
    setShow(false);
  }

  async function install() {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      // A BeforeInstallPromptEvent can only be prompted once - always clear
      // it after use, whether the user accepted or dismissed the dialog.
      deferredPrompt.current = null;
      setCanPromptInstall(false);
      if (choice.outcome === 'accepted') {
        localStorage.setItem('pwaBannerDismissed', '1');
        setShow(false);
      }
      // If dismissed, leave the banner up - the user might have just
      // misclicked, and Chrome won't refire beforeinstallprompt this
      // session for us to offer it again.
    } finally {
      setInstalling(false);
    }
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
              : canPromptInstall
                ? 'One tap, no app store needed'
                : 'Tap your browser menu → "Add to Home Screen"'}
          </p>
        </div>
        {!ios && canPromptInstall && (
          <button
            onClick={install}
            disabled={installing}
            className="flex-shrink-0 text-xs font-semibold rounded-sm transition-colors"
            style={{
              color: C.bg,
              background: installing ? C.gold : C.goldBright,
              padding: '6px 12px',
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        )}
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
