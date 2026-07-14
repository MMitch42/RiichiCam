import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - RiichiCam",
  description: "Privacy policy for RiichiCam: what data we collect, how we use it, and your rights.",
};

const s = {
  page:    { maxWidth: 680, margin: "0 auto", padding: "48px 24px", fontFamily: "sans-serif", color: "#e8dcc8", background: "#080c12", minHeight: "100vh" } as React.CSSProperties,
  h1:      { marginTop: 32, color: "#c9a227" } as React.CSSProperties,
  h2:      { marginTop: 36, marginBottom: 8, color: "#c9a227", fontSize: 18 } as React.CSSProperties,
  meta:    { color: "#9a8a6a", fontSize: 14, marginTop: 4 } as React.CSSProperties,
  p:       { lineHeight: 1.7, marginTop: 8 } as React.CSSProperties,
  ul:      { paddingLeft: 20, lineHeight: 1.8, marginTop: 8 } as React.CSSProperties,
  a:       { color: "#c9a227" } as React.CSSProperties,
  note:    { background: "#0f1520", border: "1px solid rgba(201,162,39,0.25)", borderRadius: 6, padding: "12px 16px", marginTop: 12, fontSize: 14, color: "#9a8a6a", lineHeight: 1.7 } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <main style={s.page}>
      <Link href="/" style={s.a}>← Back to RiichiCam</Link>

      <h1 style={s.h1}>Privacy Policy</h1>
      <p style={s.meta}>Last updated: May 19, 2026</p>

      <p style={s.p}>
        RiichiCam is a free, open-source riichi mahjong scoring tool. This policy explains what
        data is collected, why, and what choices you have. We collect as little as possible.
      </p>

      {/* ── 1. What we collect ─────────────────────────────────── */}
      <h2 style={s.h2}>1. What we collect</h2>
      <ul style={s.ul}>
        <li>
          <strong>Camera images</strong>: Photos you take are sent to our detection API.
          They are <em>not stored</em> unless you explicitly opt in (see §3 below).
        </li>
        <li>
          <strong>Training metadata (opt-in only)</strong>: When you consent to contribute
          training data, each saved image is accompanied by: a timestamp, the scan mode used,
          an anonymous session ID (randomly generated per session, not linked to you), image
          dimensions, and the model's tile predictions.
        </li>
        <li>
          <strong>Analytics</strong>: We use Vercel Analytics (cookieless) and Google
          Analytics 4 to collect anonymous usage statistics such as page views and session
          counts. Neither service is configured to collect personally identifiable information.
        </li>
        <li>
          <strong>Local storage</strong>: Your scoring preferences and training consent
          choice are saved in your browser's local storage. This data never leaves your device.
        </li>
      </ul>
      <p style={s.note}>
        We do not collect your name, email address, IP address, or any account information.
        RiichiCam has no user accounts.
      </p>

      {/* ── 2. Camera & images ─────────────────────────────────── */}
      <h2 style={s.h2}>2. Camera access and image processing</h2>
      <p style={s.p}>
        Camera access is requested only when you use the tile-scanning feature and is never
        active in the background. Each image is sent over HTTPS to our server, forwarded to
        a tile detection model, and the result is returned to you. The image is then discarded
        from server memory.
      </p>
      <p style={s.p}>
        Images may incidentally capture your hands or surroundings. We do not use these images
        for any purpose other than tile detection, and they are not retained unless you opt in.
      </p>

      {/* ── 3. Training data contribution ──────────────────────── */}
      <h2 style={s.h2}>3. Training data contribution (opt-in)</h2>
      <p style={s.p}>
        If you choose to help improve RiichiCam, your scanned images and accompanying metadata
        are stored privately in Vercel Blob storage. This data is used solely to retrain and
        improve the tile detection model. It is not shared with third parties, sold, or used
        for advertising.
      </p>
      <p style={s.p}>
        You can withdraw consent at any time using the toggle in the app footer. Withdrawing
        consent stops future saves but does not automatically delete previously saved images.
        To request deletion of your contributed data, contact us at the address in §8.
      </p>

      {/* ── 4. Cookies & analytics ─────────────────────────────── */}
      <h2 style={s.h2}>4. Cookies and analytics</h2>
      <ul style={s.ul}>
        <li>
          <strong>Vercel Analytics</strong>: Cookieless, privacy-preserving analytics.
          No cookies are set. No cross-site tracking.
        </li>
        <li>
          <strong>Google Analytics 4</strong>: Sets first-party cookies (<code>_ga</code>,
          <code>_ga_*</code>) to distinguish sessions. Data is anonymised and aggregated.
          IP anonymisation is enabled by default in GA4. You can opt out via{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" style={s.a}>Google's opt-out browser add-on</a>.
        </li>
      </ul>

      {/* ── 5. Third-party services ────────────────────────────── */}
      <h2 style={s.h2}>5. Third-party services</h2>
      <ul style={s.ul}>
        <li>
          <strong>Roboflow</strong>: Primary tile detection inference. Images sent for
          detection are subject to{" "}
          <a href="https://roboflow.com/privacy" style={s.a}>Roboflow's privacy policy</a>.
        </li>
        <li>
          <strong>Google Gemini</strong>: Fallback tile detection. Subject to{" "}
          <a href="https://policies.google.com/privacy" style={s.a}>Google's privacy policy</a>.
        </li>
        <li>
          <strong>Vercel</strong>: Hosting, serverless functions, Blob storage, and
          analytics. Subject to{" "}
          <a href="https://vercel.com/legal/privacy-policy" style={s.a}>Vercel's privacy policy</a>.
        </li>
        <li>
          <strong>Google Analytics</strong>: Usage analytics. Subject to{" "}
          <a href="https://policies.google.com/privacy" style={s.a}>Google's privacy policy</a>.
        </li>
      </ul>

      {/* ── 6. Data retention ──────────────────────────────────── */}
      <h2 style={s.h2}>6. Data retention</h2>
      <ul style={s.ul}>
        <li>
          <strong>Detection images (not opted-in)</strong>: Discarded immediately after
          the API response is returned.
        </li>
        <li>
          <strong>Training images (opted-in)</strong>: Retained indefinitely for model
          training. Deleted upon request (see §8).
        </li>
        <li>
          <strong>Analytics</strong>: Retained per each service's default policy
          (Google Analytics default: 14 months).
        </li>
      </ul>

      {/* ── 7. Your rights ─────────────────────────────────────── */}
      <h2 style={s.h2}>7. Your rights</h2>
      <p style={s.p}>
        Depending on where you live, you may have the right to:
      </p>
      <ul style={s.ul}>
        <li>Access the training data associated with your session</li>
        <li>Request correction or deletion of your contributed images</li>
        <li>Withdraw consent for future data collection at any time (in-app toggle)</li>
        <li>Lodge a complaint with a data protection authority (EU residents: your national DPA)</li>
      </ul>
      <p style={s.p}>
        Because we do not collect identifying information, data subject requests are fulfilled
        on a best-effort basis using the anonymous session ID stored in your browser's local
        storage. To exercise any right, email us with your session ID (visible in local
        storage under the key <code>trainingSessionId</code>) and we will respond within 30 days.
      </p>

      {/* ── 8. Children's privacy ──────────────────────────────── */}
      <h2 style={s.h2}>8. Children's privacy</h2>
      <p style={s.p}>
        RiichiCam is not directed at children under 13. We do not knowingly collect personal
        information from children. If you believe a child has contributed data, contact us and
        we will delete it promptly.
      </p>

      {/* ── 9. Changes ─────────────────────────────────────────── */}
      <h2 style={s.h2}>9. Changes to this policy</h2>
      <p style={s.p}>
        If we make material changes, we will update the "Last updated" date at the top of this
        page. Continued use of RiichiCam after changes constitutes acceptance of the revised policy.
      </p>

      {/* ── 10. Contact ────────────────────────────────────────── */}
      <h2 style={s.h2}>10. Contact</h2>
      <p style={s.p}>
        Questions, deletion requests, or data subject requests:{" "}
        <a href="mailto:support.riichicam@gmail.com" style={s.a}>support.riichicam@gmail.com</a>
      </p>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(201,162,39,0.2)" }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "8px 20px",
            border: "1px solid rgba(201,162,39,0.2)",
            borderRadius: 3,
            color: "#9a8a6a",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            transition: "border-color 0.15s, color 0.15s",
          }}
        >
          ← Back to RiichiCam
        </Link>
      </div>
    </main>
  );
}
