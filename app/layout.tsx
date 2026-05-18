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
  title: "RiichiCam — Riichi Mahjong Scorer with Camera Detection",
  description: "Score riichi mahjong hands instantly. Scan tiles with your camera or input manually. Calculates all yaku, fu, han, and dealer/non-dealer payments for tsumo and ron.",
  metadataBase: new URL("https://riichicam.com"),
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  alternates: {
    canonical: "https://riichicam.com",
  },
  openGraph: {
    title: "RiichiCam — Riichi Mahjong Scorer",
    description: "Score riichi mahjong hands instantly. Scan tiles with your camera or input manually. Calculates all yaku, fu, han, and payments.",
    url: "https://riichicam.com",
    siteName: "RiichiCam",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "RiichiCam — Riichi Mahjong Scorer",
    description: "Score riichi mahjong hands instantly. Camera tile detection, all yaku and fu calculations.",
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