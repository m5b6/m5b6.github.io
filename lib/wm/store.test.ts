import { describe, expect, it, vi } from "vitest";
import {
  LAYOUT_STORAGE_KEY,
  saveLayout,
  serializeLayout,
  type LayoutStorage,
} from "./persistence";
import { WINDOW_Z_BASE, createDesktopState, desktopReducer } from "./reducer";
import { attachLayoutPersistence, createDesktopStore } from "./store";
import type { DesktopStore } from "./store";
import type { WindowId } from "./types";

const viewport = { width: 1280, height: 720 };

function openDesktop(...ids: WindowId[]) {
  const store = createDesktopStore({ viewport });
  for (const id of ids) {
    store.dispatch({
      type: "open",
      window: { id, appId: id, title: id },
    });
  }
  return store;
}

function counter() {
  const listener = vi.fn();
  return { listener, get count() { return listener.mock.calls.length; } };
}

function watch(store: DesktopStore, ids: WindowId[]) {
  const structure = counter();
  const any = counter();
  const windows = new Map(ids.map((id) => [id, counter()]));

  store.subscribeStructure(structure.listener);
  store.subscribe(any.listener);
  for (const [id, watcher] of windows) store.subscribeWindow(id, watcher.listener);

  return {
    structure,
    any,
    window: (id: WindowId) => windows.get(id) as ReturnType<typeof counter>,
  };
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

describe("desktop store subscriptions", () => {
  it("notifies only the dragged window across a whole drag", () => {
    const store = openDesktop("paint", "asylum", "about");
    const seen = watch(store, ["paint", "asylum", "about"]);
    const start = store.getWindow("asylum");

    for (let step = 0; step < 240; step += 1) {
      store.dispatch({
        type: "move",
        id: "asylum",
        position: { x: 200 + step, y: 120 + step },
      });
    }

    expect(seen.window("asylum").count).toBe(240);
    expect(seen.window("paint").count).toBe(0);
    expect(seen.window("about").count).toBe(0);
    expect(seen.structure.count).toBe(0);
    expect(seen.any.count).toBe(240);

    expect(store.getWindow("asylum")).not.toBe(start);
    expect(store.getWindowOrder()).toEqual(["paint", "asylum", "about"]);
  });

  it("hands unrelated subscribers an identical snapshot during a drag", () => {
    const store = openDesktop("paint", "asylum");
    const paintBefore = store.getWindow("paint");
    const orderBefore = store.getWindowOrder();

    for (let step = 0; step < 60; step += 1) {
      store.dispatch({
        type: "move",
        id: "asylum",
        position: { x: 300 + step, y: 200 },
      });
    }

    expect(store.getWindow("paint")).toBe(paintBefore);
    expect(store.getWindowOrder()).toBe(orderBefore);
  });

  it("notifies nobody when an action changes nothing", () => {
    const store = openDesktop("paint");
    const seen = watch(store, ["paint"]);
    const window = store.getWindow("paint");

    store.dispatch({
      type: "move",
      id: "paint",
      position: { x: window?.x ?? 0, y: window?.y ?? 0 },
    });
    store.dispatch({ type: "focus", id: "paint" });
    store.dispatch({ type: "close", id: "ghost" });
    store.dispatch({ type: "viewport", viewport });

    expect(seen.any.count).toBe(0);
    expect(seen.structure.count).toBe(0);
    expect(seen.window("paint").count).toBe(0);
  });

  it("notifies structure and every restacked window on a raise", () => {
    const store = openDesktop("a", "b", "c");
    const seen = watch(store, ["a", "b", "c"]);

    store.dispatch({ type: "focus", id: "a" });

    expect(seen.structure.count).toBe(1);
    expect(seen.window("a").count).toBe(1);
    expect(seen.window("b").count).toBe(1);
    expect(seen.window("c").count).toBe(1);
    expect(store.getWindow("a")?.zIndex).toBe(WINDOW_Z_BASE + 2);
  });

  it("notifies a closing window and the structure, but not the survivors", () => {
    const store = openDesktop("a", "b");
    store.dispatch({ type: "focus", id: "a" });

    const seen = watch(store, ["a", "b"]);
    store.dispatch({ type: "close", id: "b" });

    expect(seen.window("b").count).toBe(1);
    expect(seen.window("a").count).toBe(1);
    expect(seen.structure.count).toBe(1);
    expect(store.getWindow("b")).toBeNull();
  });

  it("leaves other windows alone when one collapses", () => {
    const store = openDesktop("a", "b");
    const seen = watch(store, ["a", "b"]);

    store.dispatch({ type: "collapse", id: "b" });

    expect(seen.window("b").count).toBe(1);
    expect(seen.window("a").count).toBe(0);
    expect(seen.structure.count).toBe(0);
    expect(store.getWindow("b")?.collapsed).toBe(true);
  });

  it("stops notifying after unsubscribe, even mid-notification", () => {
    const store = openDesktop("a");
    const seen = counter();
    const unsubscribe = store.subscribeWindow("a", () => {
      unsubscribe();
      seen.listener();
    });

    store.dispatch({ type: "move", id: "a", position: { x: 400, y: 300 } });
    store.dispatch({ type: "move", id: "a", position: { x: 420, y: 300 } });

    expect(seen.count).toBe(1);
  });

  it("replaces the whole desktop and tells everyone", () => {
    const store = openDesktop("a", "b");
    const seen = watch(store, ["a", "b", "c"]);
    const next = desktopReducer(createDesktopState(viewport), {
      type: "open",
      window: { id: "c", appId: "c", title: "c" },
    });

    store.replace(next);

    expect(store.getWindowOrder()).toEqual(["c"]);
    expect(seen.window("a").count).toBe(1);
    expect(seen.window("b").count).toBe(1);
    expect(seen.window("c").count).toBe(1);
    expect(seen.structure.count).toBe(1);
    expect(store.replace(next)).toBeUndefined();
  });

  it("starts from an injected state", () => {
    const initialState = desktopReducer(createDesktopState(viewport), {
      type: "open",
      window: { id: "paint", appId: "paint", title: "Paint" },
    });

    expect(createDesktopStore({ initialState }).getWindowOrder()).toEqual([
      "paint",
    ]);
  });
});

describe("layout persistence wiring", () => {
  it("restores a saved layout and then throttles writes", () => {
    const source = openDesktop("paint", "asylum");
    const storage = memoryStorage();
    saveLayout(storage, source.getState());

    const store = createDesktopStore({ viewport });
    const scheduled: (() => void)[] = [];
    const detach = attachLayoutPersistence(store, {
      storage,
      schedule: (run) => scheduled.push(run),
    });

    expect(store.getWindowOrder()).toEqual(["paint", "asylum"]);

    for (let step = 0; step < 50; step += 1) {
      store.dispatch({
        type: "move",
        id: "asylum",
        position: { x: 300 + step, y: 200 },
      });
    }

    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    expect(storage.data.get(LAYOUT_STORAGE_KEY)).toBe(
      serializeLayout(store.getState()),
    );

    store.dispatch({ type: "move", id: "asylum", position: { x: 500, y: 400 } });
    expect(scheduled).toHaveLength(2);

    detach();
    store.dispatch({ type: "move", id: "asylum", position: { x: 600, y: 400 } });
    scheduled[1]();
    expect(scheduled).toHaveLength(2);
  });

  it("survives a corrupt entry and keeps an empty desktop", () => {
    const storage = memoryStorage({ [LAYOUT_STORAGE_KEY]: "{{{" });
    const store = createDesktopStore({ viewport });

    attachLayoutPersistence(store, { storage, schedule: (run) => run() });

    expect(store.getWindowOrder()).toEqual([]);
    expect(storage.data.has(LAYOUT_STORAGE_KEY)).toBe(false);
  });

  it("is inert without a storage backend", () => {
    const store = createDesktopStore({ viewport });
    const detach = attachLayoutPersistence(store, { storage: null });

    store.dispatch({ type: "open", window: { id: "a", appId: "a", title: "a" } });
    expect(store.getWindowOrder()).toEqual(["a"]);
    expect(detach()).toBeUndefined();
  });
});
