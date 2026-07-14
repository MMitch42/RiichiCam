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
    default: "RiichiCam — Riichi Mahjong Scorer & Hand Calculator with Camera Detection",
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
    title: "RiichiCam — Riichi Mahjong Scorer & Hand Calculator",
    description: "Free riichi mahjong hand scorer. Scan tiles with your camera or input them manually to calculate all yaku, fu, han, and payments.",
    url: "https://riichicam.com",
    siteName: "RiichiCam",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "RiichiCam — Riichi Mahjong Scorer & Hand Calculator",
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
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
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