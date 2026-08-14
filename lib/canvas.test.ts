import { describe, expect, it } from "vitest";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  deduplicatePixels,
  parsePixelKey,
  participantColor,
  pixelKey,
  pointFromViewport,
} from "./canvas";

describe("canvas coordinates", () => {
  it("maps the viewport corners into shared canvas bounds", () => {
    expect(pointFromViewport(0, 0, 1000, 640)).toEqual({ x: 0, y: 0 });
    expect(pointFromViewport(999, 639, 1000, 640)).toEqual({
      x: CANVAS_WIDTH - 1,
      y: CANVAS_HEIGHT - 1,
    });
  });

  it("round-trips valid pixel keys and rejects invalid keys", () => {
    expect(parsePixelKey(pixelKey(42, 17))).toEqual({ x: 42, y: 17 });
    expect(parsePixelKey(`${CANVAS_WIDTH}:0`)).toBeNull();
    expect(parsePixelKey("not:a:pixel")).toBeNull();
  });
});

describe("agent pixel input", () => {
  it("keeps the final color for repeated coordinates", () => {
    expect(
      deduplicatePixels([
        { x: 3, y: 4, color: "#FF0000" },
        { x: 8, y: 9, color: "#0000FF" },
        { x: 3, y: 4, color: "transparent" },
      ]),
    ).toEqual([
      { x: 3, y: 4, color: "transparent" },
      { x: 8, y: 9, color: "#0000FF" },
    ]);
  });

  it("assigns a stable visible cursor color", () => {
    expect(participantColor("same-agent")).toBe(participantColor("same-agent"));
    expect(participantColor("same-agent")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
