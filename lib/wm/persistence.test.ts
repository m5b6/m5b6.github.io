import { describe, expect, it } from "vitest";
import { MENU_BAR_HEIGHT, TITLE_BAR_HEIGHT, isReachable } from "./geometry";
import {
  LAYOUT_STORAGE_KEY,
  LAYOUT_VERSION,
  clearLayout,
  loadLayout,
  restoreLayout,
  saveLayout,
  serializeLayout,
  type LayoutStorage,
} from "./persistence";
import {
  MAX_WINDOWS,
  WINDOW_Z_BASE,
  createDesktopState,
  desktopReducer,
  windowsInOrder,
} from "./reducer";
import type { DesktopAction, DesktopState } from "./types";

const viewport = { width: 1280, height: 720 };

function build(...actions: DesktopAction[]): DesktopState {
  return actions.reduce(desktopReducer, createDesktopState(viewport));
}

function sample() {
  return build(
    { type: "open", window: { id: "paint", appId: "paint", title: "Paint" } },
    { type: "open", window: { id: "asylum", appId: "asylum", title: "Asylum" } },
    { type: "open", window: { id: "about", appId: "about", title: "About" } },
    { type: "move", id: "asylum", position: { x: 500, y: 260 } },
    { type: "resize", id: "asylum", size: { width: 640, height: 420 } },
    { type: "collapse", id: "about", collapsed: true },
    { type: "focus", id: "paint" },
  );
}

function memoryStorage(seed: Record<string, string> = {}): LayoutStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("layout round trips", () => {
  it("restores geometry, collapse and focus", () => {
    const before = sample();
    const after = restoreLayout(serializeLayout(before), viewport);

    expect(after).not.toBeNull();
    expect(after?.order).toEqual(before.order);
    expect(after?.focusedId).toBe("paint");
    expect(after?.cascadeIndex).toBe(before.cascadeIndex);
    expect(windowsInOrder(after as DesktopState)).toEqual(
      windowsInOrder(before),
    );
  });

  it("is stable across repeated saves and restores", () => {
    const once = restoreLayout(serializeLayout(sample()), viewport);
    const twice = restoreLayout(serializeLayout(once as DesktopState), viewport);

    expect(twice).toEqual(once);
  });

  it("restores an empty desktop as an empty desktop", () => {
    const empty = createDesktopState(viewport);
    expect(restoreLayout(serializeLayout(empty), viewport)).toEqual(empty);
  });

  it("re-derives z-order rather than trusting the stored payload", () => {
    const restored = restoreLayout(serializeLayout(sample()), viewport);
    expect(
      windowsInOrder(restored as DesktopState).map((window) => window.zIndex),
    ).toEqual([WINDOW_Z_BASE, WINDOW_Z_BASE + 1, WINDOW_Z_BASE + 2]);
    expect(serializeLayout(sample())).not.toContain("zIndex");
  });
});

describe("stale layouts", () => {
  it("clamps a layout saved on a much larger screen", () => {
    const wide = build({
      type: "open",
      window: {
        id: "paint",
        appId: "paint",
        title: "Paint",
        position: { x: 1_100, y: 600 },
        size: { width: 900, height: 600 },
      },
    });
    const small = { width: 420, height: 320 };
    const restored = restoreLayout(serializeLayout(wide), small);

    expect(restored).not.toBeNull();
    const window = (restored as DesktopState).windows.paint;
    expect(isReachable(window, small)).toBe(true);
    expect(window.y).toBeLessThanOrEqual(small.height - TITLE_BAR_HEIGHT);
    expect(window.y).toBeGreaterThanOrEqual(MENU_BAR_HEIGHT);
    expect(window.width).toBeLessThanOrEqual(small.width);
  });
});

describe("corrupt layouts are discarded, never thrown", () => {
  const rejected: [string, string][] = [
    ["not json", "{ this is not json"],
    ["a bare string", '"paint"'],
    ["null", "null"],
    ["an array", "[]"],
    ["a future version", '{"version":99,"cascadeIndex":0,"focusedId":null,"windows":[]}'],
    ["a missing version", '{"cascadeIndex":0,"focusedId":null,"windows":[]}'],
    [
      "a non-array windows field",
      '{"version":1,"cascadeIndex":0,"focusedId":null,"windows":{}}',
    ],
    [
      "a window missing its id",
      '{"version":1,"cascadeIndex":0,"focusedId":null,"windows":[{"appId":"paint","title":"Paint","x":0,"y":20,"width":400,"height":300,"minWidth":320,"minHeight":120,"collapsed":false}]}',
    ],
    [
      "a fractional coordinate",
      '{"version":1,"cascadeIndex":0,"focusedId":null,"windows":[{"id":"a","appId":"paint","title":"Paint","x":0.5,"y":20,"width":400,"height":300,"minWidth":320,"minHeight":120,"collapsed":false}]}',
    ],
    [
      "an infinite coordinate",
      '{"version":1,"cascadeIndex":0,"focusedId":null,"windows":[{"id":"a","appId":"paint","title":"Paint","x":1e400,"y":20,"width":400,"height":300,"minWidth":320,"minHeight":120,"collapsed":false}]}',
    ],
    [
      "a zero width",
      '{"version":1,"cascadeIndex":0,"focusedId":null,"windows":[{"id":"a","appId":"paint","title":"Paint","x":0,"y":20,"width":0,"height":300,"minWidth":320,"minHeight":120,"collapsed":false}]}',
    ],
    [
      "a collapsed flag that is not a boolean",
      '{"version":1,"cascadeIndex":0,"focusedId":null,"windows":[{"id":"a","appId":"paint","title":"Paint","x":0,"y":20,"width":400,"height":300,"minWidth":320,"minHeight":120,"collapsed":"yes"}]}',
    ],
    [
      "a negative cascade index",
      '{"version":1,"cascadeIndex":-1,"focusedId":null,"windows":[]}',
    ],
    [
      "a focus on a window that is not there",
      '{"version":1,"cascadeIndex":0,"focusedId":"ghost","windows":[]}',
    ],
  ];

  for (const [label, raw] of rejected) {
    it(`discards ${label}`, () => {
      expect(restoreLayout(raw, viewport)).toBeNull();
    });
  }

  it("discards duplicate window ids", () => {
    const window = {
      id: "a",
      appId: "paint",
      title: "Paint",
      x: 24,
      y: 32,
      width: 400,
      height: 300,
      minWidth: 320,
      minHeight: 120,
      collapsed: false,
    };
    const raw = JSON.stringify({
      version: LAYOUT_VERSION,
      cascadeIndex: 0,
      focusedId: null,
      windows: [window, { ...window }],
    });

    expect(restoreLayout(raw, viewport)).toBeNull();
  });

  it("discards a layout with more windows than the desktop allows", () => {
    const windows = Array.from({ length: MAX_WINDOWS + 1 }, (_, index) => ({
      id: `w${index}`,
      appId: "paint",
      title: "Paint",
      x: 24,
      y: 32,
      width: 400,
      height: 300,
      minWidth: 320,
      minHeight: 120,
      collapsed: false,
    }));

    expect(
      restoreLayout(
        JSON.stringify({
          version: LAYOUT_VERSION,
          cascadeIndex: 0,
          focusedId: null,
          windows,
        }),
        viewport,
      ),
    ).toBeNull();
  });

  it("discards an absent or empty payload", () => {
    expect(restoreLayout(null, viewport)).toBeNull();
    expect(restoreLayout(undefined, viewport)).toBeNull();
    expect(restoreLayout("", viewport)).toBeNull();
  });
});

describe("localStorage plumbing", () => {
  it("saves and loads through a storage object", () => {
    const storage = memoryStorage();
    const before = sample();

    expect(saveLayout(storage, before)).toBe(true);
    expect(storage.data.has(LAYOUT_STORAGE_KEY)).toBe(true);
    expect(loadLayout(storage, viewport)?.order).toEqual(before.order);
  });

  it("evicts a corrupt entry so the next load starts clean", () => {
    const storage = memoryStorage({ [LAYOUT_STORAGE_KEY]: "{ nope" });

    expect(loadLayout(storage, viewport)).toBeNull();
    expect(storage.data.has(LAYOUT_STORAGE_KEY)).toBe(false);
  });

  it("returns null when there is nothing stored", () => {
    expect(loadLayout(memoryStorage(), viewport)).toBeNull();
    expect(loadLayout(null, viewport)).toBeNull();
    expect(saveLayout(null, sample())).toBe(false);
    expect(clearLayout(null)).toBe(false);
  });

  it("swallows storage that throws, in either direction", () => {
    const hostile: LayoutStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };

    expect(loadLayout(hostile, viewport)).toBeNull();
    expect(saveLayout(hostile, sample())).toBe(false);
    expect(clearLayout(hostile)).toBe(false);
  });

  it("clears the stored layout on demand", () => {
    const storage = memoryStorage();
    saveLayout(storage, sample());

    expect(clearLayout(storage)).toBe(true);
    expect(storage.data.has(LAYOUT_STORAGE_KEY)).toBe(false);
  });
});
