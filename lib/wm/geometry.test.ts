import { describe, expect, it } from "vitest";
import {
  CASCADE_ORIGIN,
  CASCADE_STEP,
  CASCADE_WRAP_STEP,
  DEFAULT_WINDOW_SIZE,
  MENU_BAR_HEIGHT,
  MIN_VISIBLE_EDGE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  TITLE_BAR_HEIGHT,
  cascadePosition,
  cascadeSlots,
  clampPosition,
  clampRect,
  clampSize,
  effectiveHeight,
  isReachable,
  normalizeViewport,
  originBounds,
} from "./geometry";

const viewport = { width: 1280, height: 720 };
const size = { width: 420, height: 300 };
const constraint = { minWidth: MIN_WINDOW_WIDTH, minHeight: MIN_WINDOW_HEIGHT };

describe("window geometry clamping", () => {
  it("never lets a title bar slide under the menu bar", () => {
    expect(clampPosition({ x: 100, y: -500 }, size, viewport).y).toBe(
      MENU_BAR_HEIGHT,
    );
    expect(clampPosition({ x: 100, y: 0 }, size, viewport).y).toBe(
      MENU_BAR_HEIGHT,
    );
    expect(clampPosition({ x: 100, y: MENU_BAR_HEIGHT }, size, viewport).y).toBe(
      MENU_BAR_HEIGHT,
    );
  });

  it("keeps a grabbable strip on every edge", () => {
    const left = clampPosition({ x: -9_999, y: 200 }, size, viewport);
    expect(left.x + size.width).toBe(MIN_VISIBLE_EDGE);

    const right = clampPosition({ x: 9_999, y: 200 }, size, viewport);
    expect(right.x).toBe(viewport.width - MIN_VISIBLE_EDGE);

    const bottom = clampPosition({ x: 200, y: 9_999 }, size, viewport);
    expect(bottom.y).toBe(viewport.height - TITLE_BAR_HEIGHT);
  });

  it("leaves in-bounds positions untouched", () => {
    expect(clampPosition({ x: 300, y: 240 }, size, viewport)).toEqual({
      x: 300,
      y: 240,
    });
    expect(isReachable({ x: 300, y: 240, ...size }, viewport)).toBe(true);
    expect(isReachable({ x: -9_999, y: 240, ...size }, viewport)).toBe(false);
  });

  it("reports the drag-back-reachable region for the window origin", () => {
    const bounds = originBounds(size, viewport);
    expect(bounds).toEqual({
      minX: MIN_VISIBLE_EDGE - size.width,
      maxX: viewport.width - MIN_VISIBLE_EDGE,
      minY: MENU_BAR_HEIGHT,
      maxY: viewport.height - TITLE_BAR_HEIGHT,
    });

    for (const corner of [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.minX, y: bounds.maxY },
      { x: bounds.maxX, y: bounds.maxY },
    ]) {
      expect(clampPosition(corner, size, viewport)).toEqual(corner);
    }
  });

  it("survives degenerate viewports without losing the menu bar rule", () => {
    const tiny = { width: 10, height: 10 };
    const position = clampPosition({ x: 5, y: 5 }, size, tiny);
    expect(position.y).toBe(MENU_BAR_HEIGHT);
    expect(Number.isFinite(position.x)).toBe(true);
  });

  it("replaces non-finite coordinates with the safe lower bound", () => {
    const nan = clampPosition(
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      size,
      viewport,
    );
    expect(nan).toEqual({
      x: MIN_VISIBLE_EDGE - size.width,
      y: MENU_BAR_HEIGHT,
    });
  });

  it("rounds fractional coordinates to whole pixels", () => {
    expect(clampPosition({ x: 300.4, y: 240.6 }, size, viewport)).toEqual({
      x: 300,
      y: 241,
    });
  });
});

describe("window size clamping", () => {
  it("honours the minimum size", () => {
    expect(clampSize({ width: 10, height: 10 }, constraint, viewport)).toEqual({
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT,
    });
  });

  it("never exceeds the usable desktop", () => {
    const clamped = clampSize(
      { width: 99_999, height: 99_999 },
      constraint,
      viewport,
    );
    expect(clamped).toEqual({
      width: viewport.width,
      height: viewport.height - MENU_BAR_HEIGHT,
    });
  });

  it("prefers the minimum size when the viewport is smaller than it", () => {
    const clamped = clampSize({ width: 400, height: 400 }, constraint, {
      width: 200,
      height: 100,
    });
    expect(clamped).toEqual({
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT,
    });
  });

  it("clamps rect size before position", () => {
    const rect = clampRect(
      { x: 9_999, y: 9_999, width: 99_999, height: 99_999 },
      constraint,
      viewport,
    );
    expect(rect.width).toBe(viewport.width);
    expect(rect.y).toBe(viewport.height - TITLE_BAR_HEIGHT);
    expect(isReachable(rect, viewport)).toBe(true);
  });

  it("measures a collapsed window as a lone title bar", () => {
    expect(effectiveHeight({ height: 300, collapsed: false })).toBe(300);
    expect(effectiveHeight({ height: 300, collapsed: true })).toBe(
      TITLE_BAR_HEIGHT,
    );
  });

  it("normalises hostile viewports", () => {
    expect(normalizeViewport({ width: 0, height: -4 })).toEqual({
      width: 1,
      height: 1,
    });
    expect(
      normalizeViewport({ width: Number.NaN, height: Number.NaN }),
    ).toEqual({ width: 1280, height: 720 });
  });
});

describe("cascade placement", () => {
  it("starts below the menu bar at the left margin", () => {
    expect(cascadePosition(0, DEFAULT_WINDOW_SIZE, viewport)).toEqual(
      CASCADE_ORIGIN,
    );
  });

  it("offsets each new window down and to the right", () => {
    expect(cascadePosition(1, DEFAULT_WINDOW_SIZE, viewport)).toEqual({
      x: CASCADE_ORIGIN.x + CASCADE_STEP.x,
      y: CASCADE_ORIGIN.y + CASCADE_STEP.y,
    });
    expect(cascadePosition(2, DEFAULT_WINDOW_SIZE, viewport)).toEqual({
      x: CASCADE_ORIGIN.x + CASCADE_STEP.x * 2,
      y: CASCADE_ORIGIN.y + CASCADE_STEP.y * 2,
    });
  });

  it("wraps back to the top with a horizontal nudge", () => {
    const slots = cascadeSlots(DEFAULT_WINDOW_SIZE, viewport);
    expect(slots).toBeGreaterThan(1);

    const wrapped = cascadePosition(slots, DEFAULT_WINDOW_SIZE, viewport);
    expect(wrapped.y).toBe(CASCADE_ORIGIN.y);
    expect(wrapped.x).toBe(CASCADE_ORIGIN.x + CASCADE_WRAP_STEP);

    const twice = cascadePosition(slots * 2, DEFAULT_WINDOW_SIZE, viewport);
    expect(twice.y).toBe(CASCADE_ORIGIN.y);
    expect(twice.x).toBe(CASCADE_ORIGIN.x + CASCADE_WRAP_STEP * 2);
  });

  it("keeps every cascade slot fully reachable, at any viewport", () => {
    for (const bounds of [
      viewport,
      { width: 375, height: 667 },
      { width: 640, height: 400 },
      { width: 2560, height: 1440 },
      { width: 120, height: 90 },
    ]) {
      const placed = clampSize(DEFAULT_WINDOW_SIZE, constraint, bounds);
      for (let index = 0; index < 200; index += 1) {
        const position = cascadePosition(index, placed, bounds);
        expect(isReachable({ ...position, ...placed }, bounds), `${index}`).toBe(
          true,
        );
        expect(position.y).toBeGreaterThanOrEqual(MENU_BAR_HEIGHT);
      }
    }
  });

  it("collapses to a single slot when nothing fits", () => {
    const bounds = { width: 100, height: 100 };
    expect(cascadeSlots(DEFAULT_WINDOW_SIZE, bounds)).toBe(1);
    expect(cascadePosition(-5, DEFAULT_WINDOW_SIZE, viewport)).toEqual(
      CASCADE_ORIGIN,
    );
  });
});
