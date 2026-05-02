import type { Tile } from "./types";

export interface RawPrediction {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_CONFIDENCE = 0.45;

export function roboflowLabelToTile(label: string): Tile {
  const suited = label.match(/^([1-9])([mps])(r?)$/);
  if (suited) {
    const value = parseInt(suited[1], 10) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    const suitChar = suited[2];
    const isAka = suited[3] === "r";
    const suit = suitChar === "m" ? "man" : suitChar === "p" ? "pin" : "sou";
    return { suit, value, ...(isAka ? { isAka: true } : {}) };
  }

  const honor = label.match(/^([1-7])z$/);
  if (honor) {
    const honorMap: Record<string, Tile> = {
      "1z": { suit: "honor", value: "east" },
      "2z": { suit: "honor", value: "south" },
      "3z": { suit: "honor", value: "west" },
      "4z": { suit: "honor", value: "north" },
      "5z": { suit: "honor", value: "haku" },
      "6z": { suit: "honor", value: "hatsu" },
      "7z": { suit: "honor", value: "chun" },
    };
    return honorMap[label];
  }

  throw new Error(`Unrecognized Roboflow tile label: "${label}"`);
}

export function parsePredictions(predictions: RawPrediction[]): Tile[] {
  return predictions
    .filter((p) => p.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => a.x - b.x)
    .map((p) => roboflowLabelToTile(p.class));
}
