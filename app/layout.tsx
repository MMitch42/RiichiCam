import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RiichiCam",
  description: "Riichi mahjong scoring with camera tile detection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
