import { ImageResponse } from "next/og";

// Social share card shown when riichicam.com is linked on Twitter/X, Discord,
// iMessage, Slack, etc. Prerendered at build time — no external assets needed.
export const alt =
  "RiichiCam — free riichi mahjong hand scorer and scoring calculator with camera tile detection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#c9a227";
const GOLD_BRIGHT = "#e8c547";
const BG = "#080c12";
const SURFACE = "#141c28";
const TEXT = "#f0ead8";
const TEXT_SEC = "#8a7f6a";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: BG,
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 104,
              borderRadius: 12,
              background: SURFACE,
              border: `4px solid ${GOLD}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 700,
              color: GOLD,
            }}
          >
            中
          </div>
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: 8,
              color: GOLD,
            }}
          >
            RIICHICAM
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 56,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.1,
            color: TEXT,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          Riichi mahjong hand scorer
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.1,
            color: GOLD_BRIGHT,
          }}
        >
          in seconds
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 40,
            fontSize: 32,
            lineHeight: 1.4,
            color: TEXT_SEC,
            maxWidth: 900,
          }}
        >
          Scan your tiles with your camera or input them manually. Yaku, fu,
          han, and payments — instantly and free.
        </div>
      </div>
    ),
    { ...size },
  );
}
