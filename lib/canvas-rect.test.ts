import { describe, expect, it } from "vitest";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  pointFromRect,
  pointFromViewport,
} from "@/lib/canvas";

/** The exact points e2e paints at, which pin the live coordinate contract. */
const PAINT_POINTS = [
  [980, 180],
  [1120, 300],
  [1050, 610],
  [1180, 650],
  [1000, 600],
] as const;

/** The canvas keeps its aspect and centres inside the viewport. */
function letterbox(viewportWidth: number, viewportHeight: number) {
  const scale = Math.min(
    viewportWidth / CANVAS_WIDTH,
    viewportHeight / CANVAS_HEIGHT,
  );
  const width = CANVAS_WIDTH * scale;
  const height = CANVAS_HEIGHT * scale;

  return {
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height,
  };
}

describe("a viewport that already matches the canvas aspect", () => {
  const rect = letterbox(1280, 720);

  it("fills the viewport exactly, so nothing is letterboxed", () => {
    expect(rect).toEqual({ left: 0, top: 0, width: 1280, height: 720 });
  });

  it.each(PAINT_POINTS)(
    "maps (%i, %i) identically to the viewport mapping it replaces",
    (x, y) => {
      expect(pointFromRect(x, y, rect)).toEqual(
        pointFromViewport(x, y, 1280, 720),
      );
    },
  );
});

describe("a tall phone viewport", () => {
  const viewport = { width: 390, height: 844 };
  const rect = letterbox(viewport.width, viewport.height);

  it("letterboxes rather than stretching the painting", () => {
    expect(rect.width).toBe(390);
    expect(rect.height).toBeCloseTo(219.375, 3);
    expect(rect.top).toBeGreaterThan(0);
  });

  it("keeps painted pixels square", () => {
    const horizontal = rect.width / CANVAS_WIDTH;
    const vertical = rect.height / CANVAS_HEIGHT;

    expect(horizontal).toBeCloseTo(vertical, 6);
  });

  it("stretched the painting ~3.85x vertically before this fix", () => {
    const stretched = viewport.height / CANVAS_HEIGHT / (viewport.width / CANVAS_WIDTH);

    expect(stretched).toBeGreaterThan(3.8);
  });

  it("maps the centre of the letterboxed canvas to the centre pixel", () => {
    const centre = pointFromRect(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rect,
    );

    expect(centre).toEqual({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  });

  it("clamps a point in the letterbox bar to the canvas edge", () => {
    expect(pointFromRect(200, 0, rect).y).toBe(0);
    expect(pointFromRect(200, viewport.height, rect).y).toBe(CANVAS_HEIGHT - 1);
  });
});
