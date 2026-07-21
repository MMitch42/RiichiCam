import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#c9a227",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: "RiichiCam - Riichi Mahjong Scorer & Hand Calculator with Camera Detection",
    template: "%s · RiichiCam",
  },
  description: "Free riichi mahjong hand scorer and scoring calculator. Scan tiles with your camera or input them manually to calculate all yaku, fu, han, and dealer/non-dealer payments for tsumo and ron.",
  applicationName: "RiichiCam",
  metadataBase: new URL("https://riichicam.com"),
  manifest: "/manifest.json",
  keywords: [
    "mahjong hand scorer",
    "riichi mahjong scoring",
    "riichi mahjong calculator",
    "mahjong scoring calculator",
    "riichi scoring tool",
    "mahjong yaku calculator",
    "japanese mahjong scorer",
  ],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  alternates: {
    canonical: "https://riichicam.com",
  },
  openGraph: {
    title: "RiichiCam - Riichi Mahjong Scorer & Hand Calculator",
    description: "Free riichi mahjong hand scorer. Scan tiles with your camera or input them manually to calculate all yaku, fu, han, and payments.",
    url: "https://riichicam.com",
    siteName: "RiichiCam",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "RiichiCam - Riichi Mahjong Scorer & Hand Calculator",
    description: "Free riichi mahjong hand scorer with camera tile detection. All yaku, fu, and payment calculations.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <Script id="sw-register" strategy="afterInteractive">{`
          // Ask the browser to keep our Cache Storage from being evicted under
          // storage pressure. The ~80MB ONNX model lives in the SW cache; on
          // storage-constrained budget devices, best-effort (non-persistent)
          // storage gets evicted between sessions, which forces a full model
          // re-download every visit (multi-minute loads on mobile). Persisted
          // storage survives eviction, so the model stays cached. Silent no-op
          // where unsupported or not granted.
          if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persisted().then(function (already) {
              if (!already) navigator.storage.persist();
            }).catch(function () {});
          }
          if ('serviceWorker' in navigator) {
            // Auto-update: when an updated service worker takes control, reload
            // once so the running page switches to the new build with no user
            // action. Two guards: __rc_refreshing stops the single reload from
            // looping, and __rc_hadController skips the harmless first-install
            // case (controller goes null -> SW on a first visit, which is not
            // an update and must not trigger a reload).
            var __rc_refreshing = false;
            var __rc_hadController = !!navigator.serviceWorker.controller;
            navigator.serviceWorker.addEventListener('controllerchange', function () {
              if (!__rc_hadController) { __rc_hadController = true; return; }
              if (__rc_refreshing) return;
              __rc_refreshing = true;
              window.location.reload();
            });
            navigator.serviceWorker.register('/sw.js').then(function (reg) {
              reg.update();
              // Re-check for a new build when the app is foregrounded (PWA
              // launch/resume) and hourly while it stays open.
              document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible') reg.update();
              });
              setInterval(function () { reg.update(); }, 60 * 60 * 1000);
            }).catch(function () {});
          }
        `}</Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-MH0EYQL4VG" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-MH0EYQL4VG');
        `}</Script>
      </body>
    </html>
  );
}