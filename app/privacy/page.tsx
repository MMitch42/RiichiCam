import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — RiichiCam",
  description: "Privacy policy for RiichiCam.",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px", fontFamily: "sans-serif", color: "#e8dcc8", background: "#080c12", minHeight: "100vh" }}>
      <Link href="/" style={{ color: "#c9a227", textDecoration: "none", fontSize: 14 }}>← Back to RiichiCam</Link>

      <h1 style={{ marginTop: 32, color: "#c9a227" }}>Privacy Policy</h1>
      <p style={{ color: "#9a8a6a", fontSize: 14 }}>Last updated: May 2025</p>

      <h2>What we collect</h2>
      <p>RiichiCam collects minimal data to operate the service:</p>
      <ul>
        <li><strong>Camera images</strong> — Photos you take or upload are sent to our tile detection API and are not stored unless you explicitly opt in to help improve detection accuracy.</li>
        <li><strong>Usage analytics</strong> — We use Vercel Analytics and Google Analytics (GA4) to collect anonymous usage statistics (page views, session counts). No personally identifiable information is collected.</li>
        <li><strong>Local storage</strong> — Your rules preferences and training consent choice are saved locally on your device and never transmitted to our servers.</li>
      </ul>

      <h2>Camera and images</h2>
      <p>
        Images you capture are sent to our server solely to detect mahjong tiles. They are not stored by default.
        If you choose to help improve RiichiCam by contributing training images, you will be shown an explicit consent prompt before any image is saved. You can withdraw consent at any time via the in-app toggle.
      </p>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Roboflow</strong> — Tile detection model inference. Images sent for detection are subject to <a href="https://roboflow.com/privacy" style={{ color: "#c9a227" }}>Roboflow's privacy policy</a>.</li>
        <li><strong>Google Gemini</strong> — Fallback tile detection. Subject to <a href="https://policies.google.com/privacy" style={{ color: "#c9a227" }}>Google's privacy policy</a>.</li>
        <li><strong>Vercel</strong> — Hosting and analytics. Subject to <a href="https://vercel.com/legal/privacy-policy" style={{ color: "#c9a227" }}>Vercel's privacy policy</a>.</li>
        <li><strong>Google Analytics</strong> — Anonymous usage analytics. Subject to <a href="https://policies.google.com/privacy" style={{ color: "#c9a227" }}>Google's privacy policy</a>.</li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We do not maintain user accounts or personal profiles. Opted-in training images are stored securely and used only to improve tile detection accuracy. Analytics data is retained per the respective service's default retention policies.
      </p>

      <h2>Children's privacy</h2>
      <p>RiichiCam does not knowingly collect personal information from children under 13.</p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email <a href="mailto:mitchell.magid@gmail.com" style={{ color: "#c9a227" }}>mitchell.magid@gmail.com</a>.
      </p>
    </main>
  );
}
