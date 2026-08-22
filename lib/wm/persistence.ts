import { z } from "zod";
import { DEFAULT_VIEWPORT } from "./geometry";
import { MAX_WINDOWS, createDesktopState, desktopReducer } from "./reducer";
import type { DesktopState, Viewport } from "./types";

export const LAYOUT_STORAGE_KEY = "m5b6.desktop.layout";
export const LAYOUT_VERSION = 1;

const identifier = z.string().min(1).max(64);
const coordinate = z.number().int().gte(-100_000).lte(100_000);
const dimension = z.number().int().gte(1).lte(100_000);

const persistedWindowSchema = z.object({
  id: identifier,
  appId: identifier,
  title: z.string().min(1).max(120),
  x: coordinate,
  y: coordinate,
  width: dimension,
  height: dimension,
  minWidth: dimension,
  minHeight: dimension,
  collapsed: z.boolean(),
});

const persistedLayoutSchema = z.object({
  version: z.literal(LAYOUT_VERSION),
  cascadeIndex: z.number().int().gte(0).lte(1_000_000),
  focusedId: identifier.nullable(),
  windows: z.array(persistedWindowSchema).max(MAX_WINDOWS),
});

export type PersistedLayout = z.infer<typeof persistedLayoutSchema>;

export type LayoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function serializeLayout(state: DesktopState) {
  const layout: PersistedLayout = {
    version: LAYOUT_VERSION,
    cascadeIndex: state.cascadeIndex,
    focusedId: state.focusedId,
    windows: state.order.map((id) => {
      const window = state.windows[id];
      return {
        id: window.id,
        appId: window.appId,
        title: window.title,
        x: window.x,
        y: window.y,
        width: window.width,
        height: window.height,
        minWidth: window.minWidth,
        minHeight: window.minHeight,
        collapsed: window.collapsed,
      };
    }),
  };

  return JSON.stringify(layout);
}

function parseLayout(raw: string): PersistedLayout | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = persistedLayoutSchema.safeParse(candidate);
  if (!parsed.success) return null;

  const ids = new Set(parsed.data.windows.map((window) => window.id));
  if (ids.size !== parsed.data.windows.length) return null;
  if (parsed.data.focusedId !== null && !ids.has(parsed.data.focusedId)) {
    return null;
  }

  return parsed.data;
}

export function restoreLayout(
  raw: string | null | undefined,
  viewport: Viewport = DEFAULT_VIEWPORT,
): DesktopState | null {
  if (typeof raw !== "string" || raw.length === 0) return null;

  const layout = parseLayout(raw);
  if (!layout) return null;

  let state = createDesktopState(viewport);
  for (const window of layout.windows) {
    state = desktopReducer(state, {
      type: "open",
      window: {
        id: window.id,
        appId: window.appId,
        title: window.title,
        position: { x: window.x, y: window.y },
        size: { width: window.width, height: window.height },
        minSize: { width: window.minWidth, height: window.minHeight },
        collapsed: window.collapsed,
      },
    });
  }

  if (layout.focusedId) {
    state = desktopReducer(state, { type: "focus", id: layout.focusedId });
  }

  return { ...state, cascadeIndex: layout.cascadeIndex };
}

export function resolveLayoutStorage(): LayoutStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadLayout(
  storage: LayoutStorage | null,
  viewport: Viewport = DEFAULT_VIEWPORT,
): DesktopState | null {
  if (!storage) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(LAYOUT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const restored = restoreLayout(raw, viewport);
  if (!restored) {
    try {
      storage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  return restored;
}

export function saveLayout(
  storage: LayoutStorage | null,
  state: DesktopState,
) {
  if (!storage) return false;

  try {
    storage.setItem(LAYOUT_STORAGE_KEY, serializeLayout(state));
    return true;
  } catch {
    return false;
  }
}

export function clearLayout(storage: LayoutStorage | null) {
  if (!storage) return false;

  try {
    storage.removeItem(LAYOUT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
