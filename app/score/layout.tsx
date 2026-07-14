import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mahjong Hand Scorer & Calculator",
  description:
    "Score a riichi mahjong hand: scan your tiles with the camera or build the hand manually, then get every yaku, a full fu breakdown, total han, and exact tsumo and ron payments.",
  alternates: { canonical: "https://riichicam.com/score" },
  openGraph: {
    title: "Mahjong Hand Scorer & Calculator · RiichiCam",
    description:
      "Scan or input a riichi mahjong hand and get yaku, fu, han, and payments instantly.",
    url: "https://riichicam.com/score",
  },
};

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
