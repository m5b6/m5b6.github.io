import { describe, expect, it } from "vitest";
import { APPS } from "@/lib/apps/manifest";
import {
  MENU_BAR_HEIGHT,
  MIN_VISIBLE_EDGE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  TITLE_BAR_HEIGHT,
  isReachable,
} from "./geometry";
import {
  MAX_WINDOWS,
  WINDOW_Z_BASE,
  createDesktopState,
  desktopReducer,
  topWindowId,
  windowsInOrder,
} from "./reducer";
import type { DesktopAction, DesktopState, WindowId } from "./types";

const viewport = { width: 1280, height: 720 };

function open(state: DesktopState, id: WindowId, appId = "paint") {
  return desktopReducer(state, {
    type: "open",
    window: { id, appId, title: id },
  });
}

function run(state: DesktopState, actions: DesktopAction[]) {
  return actions.reduce<DesktopState>(desktopReducer, state);
}

function desktop(...ids: WindowId[]) {
  let state = createDesktopState(viewport);
  for (const id of ids) state = open(state, id);
  return state;
}

function zIndexes(state: DesktopState) {
  return state.order.map((id) => state.windows[id].zIndex);
}

describe("opening windows", () => {
  it("cascades, focuses and fronts each new window", () => {
    const state = desktop("a", "b", "c");

    expect(state.order).toEqual(["a", "b", "c"]);
    expect(state.focusedId).toBe("c");
    expect(state.windows.c.focused).toBe(true);
    expect(state.windows.a.focused).toBe(false);
    expect(state.windows.b.x).toBeGreaterThan(state.windows.a.x);
    expect(state.windows.b.y).toBeGreaterThan(state.windows.a.y);
    expect(state.cascadeIndex).toBe(3);
  });

  it("re-opening an existing id raises it instead of duplicating", () => {
    const state = open(desktop("a", "b", "c"), "a");

    expect(state.order).toEqual(["b", "c", "a"]);
    expect(Object.keys(state.windows)).toHaveLength(3);
    expect(state.focusedId).toBe("a");
    expect(state.cascadeIndex).toBe(3);
  });

  it("honours explicit geometry and minimum sizes, clamped to the desktop", () => {
    const state = desktopReducer(createDesktopState(viewport), {
      type: "open",
      window: {
        id: "asylum",
        appId: "asylum",
        title: "The Asylum",
        position: { x: -4_000, y: -4_000 },
        size: { width: 10, height: 10 },
        minSize: { width: 480, height: 200 },
      },
    });

    const window = state.windows.asylum;
    expect(window.minWidth).toBe(480);
    expect(window.minHeight).toBe(200);
    expect(window.width).toBe(480);
    expect(window.height).toBe(200);
    expect(window.y).toBe(MENU_BAR_HEIGHT);
    expect(window.x + window.width).toBe(MIN_VISIBLE_EDGE);
  });

  it("honours a declared minimum instead of overriding it with the floor", () => {
    const state = desktopReducer(createDesktopState(viewport), {
      type: "open",
      window: {
        id: "tiny",
        appId: "paint",
        title: "Tiny",
        minSize: { width: 240, height: 220 },
      },
    });

    expect(state.windows.tiny.minWidth).toBe(240);
    expect(state.windows.tiny.minHeight).toBe(220);
  });

  it("falls back to the floor only when no minimum is declared", () => {
    const state = desktopReducer(createDesktopState(viewport), {
      type: "open",
      window: { id: "bare", appId: "paint", title: "Bare" },
    });

    expect(state.windows.bare.minWidth).toBe(MIN_WINDOW_WIDTH);
    expect(state.windows.bare.minHeight).toBe(MIN_WINDOW_HEIGHT);
  });

  it("opens every registered app at the size its manifest declares", () => {
    for (const app of APPS) {
      const state = desktopReducer(createDesktopState(viewport), {
        type: "open",
        window: {
          id: app.id,
          appId: app.id,
          title: app.title,
          size: app.window.size,
          minSize: app.window.minSize,
        },
      });
      const opened = state.windows[app.id];

      expect(opened.width, app.id).toBe(app.window.size.width);
      expect(opened.height, app.id).toBe(app.window.size.height);
      expect(opened.minWidth, app.id).toBe(app.window.minSize.width);
      expect(opened.minHeight, app.id).toBe(app.window.minSize.height);
    }
  });

  it("evicts the back-most window past the cap", () => {
    let state = createDesktopState(viewport);
    for (let index = 0; index < MAX_WINDOWS + 3; index += 1) {
      state = open(state, `w${index}`);
    }

    expect(state.order).toHaveLength(MAX_WINDOWS);
    expect(state.windows.w0).toBeUndefined();
    expect(state.order[0]).toBe("w3");
    expect(topWindowId(state)).toBe(`w${MAX_WINDOWS + 2}`);
    expect(zIndexes(state)).toEqual(
      Array.from({ length: MAX_WINDOWS }, (_, index) => WINDOW_Z_BASE + index),
    );
  });
});

describe("z-order integrity", () => {
  it("assigns a gapless total order back to front", () => {
    const state = desktop("a", "b", "c", "d");

    expect(zIndexes(state)).toEqual([
      WINDOW_Z_BASE,
      WINDOW_Z_BASE + 1,
      WINDOW_Z_BASE + 2,
      WINDOW_Z_BASE + 3,
    ]);
    expect(windowsInOrder(state).map((window) => window.id)).toEqual(
      state.order,
    );
  });

  it("cannot drift or overflow after thousands of focus events", () => {
    const ids = ["a", "b", "c", "d", "e"];
    let state = desktop(...ids);
    let seed = 7;

    for (let step = 0; step < 5_000; step += 1) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      state = desktopReducer(state, {
        type: step % 3 === 0 ? "bringToFront" : "focus",
        id: ids[seed % ids.length],
      });
    }

    expect(state.order).toHaveLength(ids.length);
    expect([...state.order].sort()).toEqual([...ids].sort());
    expect(zIndexes(state)).toEqual([
      WINDOW_Z_BASE,
      WINDOW_Z_BASE + 1,
      WINDOW_Z_BASE + 2,
      WINDOW_Z_BASE + 3,
      WINDOW_Z_BASE + 4,
    ]);
    expect(state.focusedId).not.toBeNull();
    expect(state.windows[state.focusedId as WindowId].focused).toBe(true);
    expect(
      windowsInOrder(state).filter((window) => window.focused),
    ).toHaveLength(1);
  });

  it("raises without stealing focus for bringToFront", () => {
    const state = desktopReducer(desktop("a", "b", "c"), {
      type: "bringToFront",
      id: "a",
    });

    expect(state.order).toEqual(["b", "c", "a"]);
    expect(state.focusedId).toBe("c");
    expect(state.windows.a.focused).toBe(false);
    expect(state.windows.c.focused).toBe(true);
  });

  it("is a no-op when the target is already front and focused", () => {
    const before = desktop("a", "b");
    expect(desktopReducer(before, { type: "focus", id: "b" })).toBe(before);
    expect(desktopReducer(before, { type: "bringToFront", id: "b" })).toBe(
      before,
    );
    expect(desktopReducer(before, { type: "focus", id: "ghost" })).toBe(before);
  });

  it("hands focus to the new front window when the focused one closes", () => {
    const state = desktopReducer(desktop("a", "b", "c"), {
      type: "close",
      id: "c",
    });

    expect(state.order).toEqual(["a", "b"]);
    expect(state.focusedId).toBe("b");
    expect(state.windows.b.focused).toBe(true);
    expect(zIndexes(state)).toEqual([WINDOW_Z_BASE, WINDOW_Z_BASE + 1]);
  });

  it("keeps focus when a background window closes", () => {
    const state = desktopReducer(desktop("a", "b", "c"), {
      type: "close",
      id: "a",
    });

    expect(state.focusedId).toBe("c");
    expect(zIndexes(state)).toEqual([WINDOW_Z_BASE, WINDOW_Z_BASE + 1]);
  });

  it("empties cleanly and ignores unknown ids", () => {
    const state = run(desktop("a"), [
      { type: "close", id: "a" },
      { type: "close", id: "a" },
    ]);

    expect(state.order).toEqual([]);
    expect(state.focusedId).toBeNull();
    expect(desktopReducer(state, { type: "close", id: "ghost" })).toBe(state);
  });
});

describe("moving and resizing", () => {
  it("clamps a drag back into reach at every edge", () => {
    const base = desktop("a");
    const window = base.windows.a;

    for (const target of [
      { x: -9_999, y: -9_999 },
      { x: 9_999, y: -9_999 },
      { x: -9_999, y: 9_999 },
      { x: 9_999, y: 9_999 },
    ]) {
      const moved = desktopReducer(base, {
        type: "move",
        id: "a",
        position: target,
      });
      const next = moved.windows.a;
      expect(isReachable(next, viewport)).toBe(true);
      expect(next.y).toBeGreaterThanOrEqual(MENU_BAR_HEIGHT);
      expect(next.y).toBeLessThanOrEqual(viewport.height - TITLE_BAR_HEIGHT);
      expect(next.width).toBe(window.width);
    }
  });

  it("returns the identical state when a move changes nothing", () => {
    const base = desktop("a");
    const window = base.windows.a;

    expect(
      desktopReducer(base, {
        type: "move",
        id: "a",
        position: { x: window.x, y: window.y },
      }),
    ).toBe(base);
    expect(
      desktopReducer(base, { type: "move", id: "a", position: { x: 0, y: -1 } }),
    ).not.toBe(base);
    expect(
      desktopReducer(base, { type: "move", id: "ghost", position: { x: 1, y: 1 } }),
    ).toBe(base);
  });

  it("leaves other windows untouched by identity while one is dragged", () => {
    const base = desktop("a", "b", "c");
    const moved = desktopReducer(base, {
      type: "move",
      id: "b",
      position: { x: 400, y: 300 },
    });

    expect(moved.windows.a).toBe(base.windows.a);
    expect(moved.windows.c).toBe(base.windows.c);
    expect(moved.windows.b).not.toBe(base.windows.b);
    expect(moved.order).toBe(base.order);
    expect(moved.focusedId).toBe(base.focusedId);
  });

  it("resizes within the window's own minimum and the desktop bounds", () => {
    const base = desktop("a");
    const shrunk = desktopReducer(base, {
      type: "resize",
      id: "a",
      size: { width: 1, height: 1 },
    });
    expect(shrunk.windows.a.width).toBe(MIN_WINDOW_WIDTH);
    expect(shrunk.windows.a.height).toBe(MIN_WINDOW_HEIGHT);

    const grown = desktopReducer(base, {
      type: "resize",
      id: "a",
      size: { width: 99_999, height: 99_999 },
    });
    expect(grown.windows.a.width).toBe(viewport.width);
    expect(grown.windows.a.height).toBe(viewport.height - MENU_BAR_HEIGHT);
    expect(isReachable(grown.windows.a, viewport)).toBe(true);
  });

  it("resizes from a moving origin and keeps the result reachable", () => {
    const resized = desktopReducer(desktop("a"), {
      type: "resize",
      id: "a",
      size: { width: 600, height: 400 },
      position: { x: -9_999, y: -9_999 },
    });

    expect(resized.windows.a.width).toBe(600);
    expect(resized.windows.a.y).toBe(MENU_BAR_HEIGHT);
    expect(resized.windows.a.x + 600).toBe(MIN_VISIBLE_EDGE);
  });
});

describe("collapsing", () => {
  it("rolls a window up and back down without moving it", () => {
    const base = desktop("a");
    const collapsed = desktopReducer(base, { type: "collapse", id: "a" });
    const restored = desktopReducer(collapsed, { type: "collapse", id: "a" });

    expect(collapsed.windows.a.collapsed).toBe(true);
    expect(collapsed.windows.a.height).toBe(base.windows.a.height);
    expect(collapsed.windows.a.x).toBe(base.windows.a.x);
    expect(collapsed.windows.a.y).toBe(base.windows.a.y);
    expect(restored.windows.a).toEqual(base.windows.a);
  });

  it("round-trips a window collapsed at the very bottom of the desktop", () => {
    const parked = desktopReducer(desktop("a"), {
      type: "move",
      id: "a",
      position: { x: 40, y: 9_999 },
    });
    const collapsed = desktopReducer(parked, {
      type: "collapse",
      id: "a",
      collapsed: true,
    });
    const restored = desktopReducer(collapsed, {
      type: "collapse",
      id: "a",
      collapsed: false,
    });

    expect(collapsed.windows.a.y).toBe(viewport.height - TITLE_BAR_HEIGHT);
    expect(restored.windows.a).toEqual(parked.windows.a);
  });

  it("ignores a redundant collapse", () => {
    const base = desktop("a");
    expect(desktopReducer(base, { type: "collapse", id: "a", collapsed: false })).toBe(
      base,
    );
    expect(desktopReducer(base, { type: "collapse", id: "ghost" })).toBe(base);
  });

  it("keeps collapsed state through a resize", () => {
    const state = run(desktop("a"), [
      { type: "collapse", id: "a", collapsed: true },
      { type: "resize", id: "a", size: { width: 700, height: 500 } },
    ]);

    expect(state.windows.a.collapsed).toBe(true);
    expect(state.windows.a.width).toBe(700);
    expect(state.windows.a.height).toBe(500);
  });
});

describe("viewport changes", () => {
  it("drags every stranded window back into reach", () => {
    const base = run(desktop("a", "b"), [
      { type: "move", id: "a", position: { x: 1_100, y: 640 } },
      { type: "move", id: "b", position: { x: 40, y: 60 } },
    ]);
    const shrunk = desktopReducer(base, {
      type: "viewport",
      viewport: { width: 420, height: 300 },
    });

    for (const window of windowsInOrder(shrunk)) {
      expect(isReachable(window, shrunk.viewport)).toBe(true);
    }
    expect(shrunk.viewport).toEqual({ width: 420, height: 300 });
    expect(shrunk.order).toBe(base.order);
  });

  it("preserves the identity of windows that did not need to move", () => {
    const base = desktop("a", "b");
    const grown = desktopReducer(base, {
      type: "viewport",
      viewport: { width: 1_600, height: 900 },
    });

    expect(grown.windows.a).toBe(base.windows.a);
    expect(grown.windows.b).toBe(base.windows.b);
    expect(grown).not.toBe(base);
  });

  it("is a no-op for an unchanged viewport", () => {
    const base = desktop("a");
    expect(desktopReducer(base, { type: "viewport", viewport })).toBe(base);
    expect(
      desktopReducer(base, {
        type: "viewport",
        viewport: { width: Number.NaN, height: Number.NaN },
      }),
    ).toBe(base);
  });
});
