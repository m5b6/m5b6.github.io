import { describe, expect, it } from "vitest";
import { MENU_BAR_HEIGHT } from "@/lib/wm/geometry";
import { createDesktopState, desktopReducer } from "@/lib/wm/reducer";
import type { Viewport } from "@/lib/wm/types";
import {
  SHELL_WINDOWS,
  STARTUP_WINDOW_IDS,
  isNarrow,
  openWindowInput,
  shellWindow,
} from "./windows";

const DESKTOP: Viewport = { width: 1280, height: 720 };
const PHONE: Viewport = { width: 390, height: 844 };

/** D2: the e2e suite paints here. Nothing the shell opens may sit on top of them. */
const PAINT_POINTS = [
  [980, 180],
  [1120, 300],
  [1050, 610],
  [1180, 650],
  [1000, 600],
] as const;

const ICON_WELL = { top: 30, bottom: 290 };

function layout(viewport: Viewport) {
  let state = createDesktopState(viewport);
  for (const spec of SHELL_WINDOWS) {
    state = desktopReducer(state, {
      type: "open",
      window: openWindowInput(spec, viewport),
    });
  }
  return state;
}

describe("where the shell puts its windows", () => {
  it("opens every window below the menu bar and inside the screen", () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const state = layout(viewport);
      for (const id of state.order) {
        const window = state.windows[id];
        expect(window.y, `${id} y`).toBeGreaterThanOrEqual(MENU_BAR_HEIGHT);
        expect(window.x, `${id} x`).toBeGreaterThanOrEqual(0);
        expect(window.x + window.width, `${id} right`).toBeLessThanOrEqual(
          viewport.width,
        );
      }
    }
  });

  it("leaves every canvas point the e2e suite paints uncovered", () => {
    const state = layout(DESKTOP);

    for (const [x, y] of PAINT_POINTS) {
      for (const id of state.order) {
        const window = state.windows[id];
        const covered =
          x >= window.x &&
          x <= window.x + window.width &&
          y >= window.y &&
          y <= window.y + window.height;
        expect(covered, `${id} covers (${x}, ${y})`).toBe(false);
      }
    }
  });

  it("keeps the icon well clear of those points too", () => {
    for (const [x, y] of PAINT_POINTS) {
      const insideWell = y >= ICON_WELL.top && y <= ICON_WELL.bottom;
      const insideColumn = x >= DESKTOP.width - 80;
      expect(insideWell && insideColumn, `(${x}, ${y})`).toBe(false);
    }
  });

  it("lays a phone out in one column and keeps the icon well reachable", () => {
    const tools = shellWindow("paint.tools");
    const phone = openWindowInput(tools, PHONE);
    expect(phone.position).toEqual(tools.narrow);
    expect(phone.size?.width).toBeGreaterThan(tools.size.width);
    expect((phone.position?.x ?? 0) + (phone.size?.width ?? 0)).toBeLessThanOrEqual(
      PHONE.width - 64,
    );

    const tiny = openWindowInput(tools, { width: 260, height: 600 });
    expect(tiny.size?.width).toBeGreaterThanOrEqual(tools.minSize.width);
    expect(tiny.size?.width).toBeLessThanOrEqual(260);

    const wide = openWindowInput(tools, DESKTOP);
    expect(wide.size?.width).toBe(tools.size.width);
    expect(wide.position).toEqual(tools.wide);
  });

  it("never lets two windows open on top of each other on a phone", () => {
    const state = layout(PHONE);
    const rects = SHELL_WINDOWS.filter((spec) =>
      ["paint.tools", "paint.profile"].includes(spec.id),
    ).map((spec) => state.windows[spec.id]);

    const [first, second] = rects.sort((a, b) => a.y - b.y);
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
  });

  it("calls a phone narrow and a desktop wide", () => {
    expect(isNarrow(PHONE)).toBe(true);
    expect(isNarrow(DESKTOP)).toBe(false);
  });

  it("launches Paint on top, because Paint is the suggested application", () => {
    const state = layout(DESKTOP);
    expect(STARTUP_WINDOW_IDS.at(-1)).toBe("paint.tools");
    expect(SHELL_WINDOWS.map((spec) => spec.id)).toEqual([
      ...new Set(SHELL_WINDOWS.map((spec) => spec.id)),
    ]);
    expect(state.order).toHaveLength(SHELL_WINDOWS.length);
  });
});
