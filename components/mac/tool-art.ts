import type { MacPixelRows } from "./mac-pixel-art";

/**
 * A brush icon drawn from the brush's own footprint, so the glyph can never
 * disagree with what the tool paints.
 */
export function brushArt(
  offsets: readonly { x: number; y: number }[],
  radius = 5,
): MacPixelRows {
  const span = radius * 2 + 1;
  const grid = Array.from({ length: span }, () => Array<string>(span).fill("."));

  for (const { x, y } of offsets) {
    const column = x + radius;
    const row = y + radius;

    if (grid[row]?.[column] !== undefined) grid[row][column] = "#";
  }

  return grid.map((row) => row.join(""));
}

export const RAINBOW_ART: MacPixelRows = [
  "...####...",
  ".##....##.",
  "##......##",
  "#..####..#",
  "..##..##..",
  ".##....##.",
  ".#......#.",
  "..........",
];

export const MIRROR_ART: MacPixelRows = [
  "###....###",
  "####..####",
  "#####..###",
  "######..##",
  "#####..###",
  "####..####",
  "###....###",
  "..........",
];

export const SURPRISE_ART: MacPixelRows = [
  "..........",
  "####..####",
  "#..#..#..#",
  "#..#..#..#",
  "####..####",
  "..........",
  "####..####",
  "#..#..#..#",
];
