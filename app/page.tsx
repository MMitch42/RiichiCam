import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RiichiCam — Riichi Mahjong Scorer with Camera Detection",
  description: "Score any riichi mahjong hand in seconds. Scan tiles with your camera or input manually. Calculates all yaku, fu, han, and dealer/non-dealer payments.",
  alternates: { canonical: "https://riichicam.com" },
};

const C = {
  bg:           '#080c12',
  surface:      '#0f1520',
  surfaceEl:    '#141c28',
  gold:         '#c9a227',
  goldBright:   '#e8c547',
  goldMuted:    'rgba(201,162,39,0.10)',
  goldBorder:   'rgba(201,162,39,0.35)',
  goldBorderSm: 'rgba(201,162,39,0.2)',
  goldBorderXs: 'rgba(201,162,39,0.12)',
  text:         '#f0ead8',
  textSec:      '#8a7f6a',
};

const STEPS = [
  {
    n: '01',
    title: 'Scan or input your hand',
    body: 'Point your camera at your tiles and let RiichiCam detect them automatically, or tap to build your hand manually from the tile palette.',
  },
  {
    n: '02',
    title: 'Set the conditions',
    body: 'Choose tsumo or ron, seat and round wind, riichi, dora indicators, and any special conditions like ippatsu or rinshan.',
  },
  {
    n: '03',
    title: 'Get your score',
    body: 'Instantly see every yaku detected, a full fu breakdown, total han, and exact payments for dealer and non-dealer wins.',
  },
];

const FEATURES = [
  {
    title: 'Camera tile detection',
    body: 'AI-powered scanning reads your hand from a photo. Correct any misdetections with a tap.',
  },
  {
    title: 'All yaku covered',
    body: 'Every standard yaku and yakuman, plus optional local yaku like Daisharin, Renho, and Sanrenkou.',
  },
  {
    title: 'Full fu breakdown',
    body: 'See exactly how fu is calculated across base, melds, pair, wait, and tsumo, rounded to the nearest 10.',
  },
  {
    title: 'iOS and Android',
    body: 'Add RiichiCam to your home screen as a PWA on any device. Works in your pocket at the table.',
  },
];

const FAQ = [
  {
    q: 'What is RiichiCam?',
    a: 'RiichiCam is a free riichi mahjong scoring calculator. You can scan tiles with your camera or input a hand manually, and it will calculate yaku, fu, han, and payments for both tsumo and ron wins.',
  },
  {
    q: 'How does the camera detection work?',
    a: 'You take a photo of your hand and RiichiCam uses an AI vision model to identify each tile. It detects closed tiles, the winning tile, dora indicators, and open melds. You can correct any mistakes before scoring.',
  },
  {
    q: 'What rules does it use?',
    a: 'RiichiCam defaults to WRC and Mahjong Soul rules: kuitan (open tanyao) allowed, three aka dora, and double-wind pair worth 4 fu. These can be adjusted in the settings.',
  },
  {
    q: 'Does it support all yaku?',
    a: 'Yes, all standard yaku and yakuman are supported. Optional local yaku (Renho, Daisharin, Sanrenkou, and others) can be toggled on in the Local Yaku section.',
  },
  {
    q: 'Is it free?',
    a: 'Completely free, no account required. If you find it useful, there\'s an optional "Buy Me a Coffee" link in the app.',
  },
  {
    q: 'Can I use it offline?',
    a: 'Manual scoring works fully offline. Camera detection requires an internet connection since it uses a cloud AI model.',
  },
];

export default function LandingPage() {
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <header style={{
          padding: '20px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${C.goldBorderXs}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="3" width="24" height="26" rx="2" fill={C.surfaceEl} stroke={C.gold} strokeWidth="1.5"/>
              <text x="16" y="22" textAnchor="middle" fontSize="15" fontWeight="700" fill={C.gold} fontFamily="serif">中</text>
            </svg>
            <span style={{ color: C.gold, fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              RiichiCam
            </span>
          </div>
          <a
            href="/score"
            style={{
              padding: '6px 14px',
              background: C.gold,
              color: C.bg,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderRadius: 2,
            }}
          >
            Open Scorer
          </a>
        </header>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section style={{ padding: '64px 0 56px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: C.text,
            margin: '0 0 20px',
          }}>
            Score any riichi hand{' '}
            <span style={{ color: C.gold }}>in seconds</span>
          </h1>
          <p style={{
            fontSize: '1rem',
            lineHeight: 1.65,
            color: C.textSec,
            margin: '0 auto 36px',
            maxWidth: 360,
          }}>
            Scan your tiles with your camera or input them manually.
            RiichiCam calculates yaku, fu, han, and payments instantly. Free, no account needed.
          </p>
          <a
            href="/score"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: C.gold,
              color: C.bg,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderRadius: 2,
            }}
          >
            Open Scorer
          </a>
          <p style={{ marginTop: 12, fontSize: 11, color: C.textSec, letterSpacing: '0.05em' }}>
            Free · No account · iOS and Android
          </p>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 56 }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: C.textSec,
            marginBottom: 24,
          }}>
            How it works
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                style={{
                  display: 'flex',
                  gap: 20,
                  padding: '20px 0',
                  borderTop: `1px solid ${C.goldBorderXs}`,
                  borderBottom: i === STEPS.length - 1 ? `1px solid ${C.goldBorderXs}` : 'none',
                }}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.gold,
                  opacity: 0.6,
                  letterSpacing: '0.08em',
                  flexShrink: 0,
                  paddingTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {step.n}
                </span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textSec, margin: 0 }}>
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 56 }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: C.textSec,
            marginBottom: 20,
          }}>
            Features
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.goldBorderXs}`,
                  borderRadius: 2,
                  padding: '16px 14px',
                }}
              >
                <h3 style={{ fontSize: 12, fontWeight: 700, color: C.gold, margin: '0 0 6px', lineHeight: 1.3 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 12, lineHeight: 1.55, color: C.textSec, margin: 0 }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 56, textAlign: 'center' }}>
          <a
            href="/score"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: C.gold,
              color: C.bg,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderRadius: 2,
            }}
          >
            Open Scorer
          </a>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 56 }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: C.textSec,
            marginBottom: 4,
          }}>
            FAQ
          </p>
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              style={{
                borderTop: `1px solid ${C.goldBorderXs}`,
                borderBottom: i === FAQ.length - 1 ? `1px solid ${C.goldBorderXs}` : 'none',
              }}
            >
              <summary style={{
                padding: '14px 0',
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                cursor: 'pointer',
                listStyle: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                userSelect: 'none',
              }}>
                {item.q}
                <span style={{ color: C.gold, fontSize: 12, flexShrink: 0 }}>▾</span>
              </summary>
              <p style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: C.textSec,
                margin: '0 0 16px',
                paddingRight: 24,
              }}>
                {item.a}
              </p>
            </details>
          ))}
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <style>{`
          .lp-btn-outline { transition: border-color 0.15s, color 0.15s; }
          .lp-btn-outline:hover { border-color: ${C.gold} !important; color: ${C.gold} !important; }
          .lp-btn-gold:hover { background: ${C.goldBright} !important; }
          .lp-link:hover { color: ${C.gold} !important; }
        `}</style>
        <footer style={{
          paddingBottom: 40,
          borderTop: `1px solid ${C.goldBorderXs}`,
          paddingTop: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div className="flex justify-center gap-2">
            <a
              href="mailto:support.riichicam@gmail.com?subject=RiichiCam Feedback"
              className="lp-btn-outline flex-1 flex items-center justify-center py-1.5 rounded-sm text-xs font-semibold tracking-wide"
              style={{ border: `1px solid ${C.goldBorderSm}`, color: C.textSec, background: 'transparent', textDecoration: 'none', maxWidth: 160 }}
            >
              Give Feedback
            </a>
            <a
              href="https://buymeacoffee.com/RiichiCam"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-gold flex-1 flex items-center justify-center py-1.5 rounded-sm text-xs font-semibold tracking-wide"
              style={{ background: C.gold, color: C.bg, textDecoration: 'none', maxWidth: 160, border: 'none' }}
            >
              ☕ Buy Me a Coffee
            </a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a
              href="https://github.com/MMitch42/RiichiCam"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-link"
              style={{ fontSize: 11, color: C.textSec, textDecoration: 'none', transition: 'color 0.15s' }}
            >
              View on GitHub
            </a>
            <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Made by Mitchell Magid</p>
          </div>
        </footer>

      </div>
    </main>
  );
}
