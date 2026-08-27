import { ASYLUM_APP, PAINT_APP, type AppId } from "@/lib/apps/manifest";
import { MENU_BAR_HEIGHT } from "@/lib/wm/geometry";
import type { OpenWindowInput, Viewport } from "@/lib/wm/types";

export const SHELL_WINDOW_IDS = {
  paintTools: "paint.tools",
  paintProfile: "paint.profile",
  ward: "asylum.ward",
  trash: "trash",
  about: "about",
} as const;

export type ShellWindowId =
  (typeof SHELL_WINDOW_IDS)[keyof typeof SHELL_WINDOW_IDS];

/** Below this the screen is a telephone and windows stack down the left edge. */
export const NARROW_VIEWPORT = 700;

export type ShellWindowSpec = {
  id: ShellWindowId;
  appId: string;
  title: string;
  size: { width: number; height: number };
  minSize: { width: number; height: number };
  wide: { x: number; y: number };
  narrow: { x: number; y: number };
};

const GUTTER = 24;
const NARROW_GUTTER = 8;
const TOP = MENU_BAR_HEIGHT + 12;
/** Width reserved on the right of a narrow screen so the icon well stays reachable. */
const ICON_COLUMN = 72;

/**
 * D2 keeps the right half of a wide screen clear: the desktop icon well lives there and
 * the canvas has to stay reachable under it. Every window opens on the left.
 */
export const SHELL_WINDOWS: readonly ShellWindowSpec[] = [
  {
    id: SHELL_WINDOW_IDS.paintTools,
    appId: PAINT_APP.id,
    title: PAINT_APP.title,
    size: PAINT_APP.window.size,
    minSize: PAINT_APP.window.minSize,
    wide: { x: GUTTER, y: TOP },
    narrow: { x: NARROW_GUTTER, y: TOP },
  },
  {
    id: SHELL_WINDOW_IDS.paintProfile,
    appId: PAINT_APP.id,
    title: "Matias Berrios",
    size: { width: 300, height: 164 },
    minSize: { width: 260, height: 140 },
    wide: { x: 318, y: 268 },
    narrow: { x: NARROW_GUTTER, y: TOP + 330 },
  },
  {
    id: SHELL_WINDOW_IDS.ward,
    appId: ASYLUM_APP.id,
    title: ASYLUM_APP.title,
    size: ASYLUM_APP.window.size,
    /** Narrower than the registry's minimum so a phone keeps its icon column. */
    minSize: { width: 300, height: 240 },
    wide: { x: 318, y: TOP },
    narrow: { x: NARROW_GUTTER, y: TOP },
  },
  {
    id: SHELL_WINDOW_IDS.trash,
    appId: "finder",
    title: "Trash",
    size: { width: 340, height: 224 },
    minSize: { width: 280, height: 160 },
    wide: { x: 318, y: TOP },
    narrow: { x: NARROW_GUTTER, y: TOP + 40 },
  },
  {
    id: SHELL_WINDOW_IDS.about,
    appId: "finder",
    title: "About This Macintosh",
    size: { width: 428, height: 264 },
    minSize: { width: 280, height: 200 },
    wide: { x: 196, y: 132 },
    narrow: { x: NARROW_GUTTER, y: TOP + 20 },
  },
];

/** The window an application's icon and Apple-menu entry open. Apps may own more. */
export const APP_MAIN_WINDOW: Readonly<Record<AppId, ShellWindowId>> = {
  paint: SHELL_WINDOW_IDS.paintTools,
  asylum: SHELL_WINDOW_IDS.ward,
};

export function shellWindow(id: ShellWindowId): ShellWindowSpec {
  const spec = SHELL_WINDOWS.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`Unknown shell window ${id}`);
  return spec;
}

export function isNarrow(viewport: Viewport) {
  return viewport.width <= NARROW_VIEWPORT;
}

export function openWindowInput(
  spec: ShellWindowSpec,
  viewport: Viewport,
): OpenWindowInput {
  const narrow = isNarrow(viewport);
  const width = narrow
    ? Math.max(
        spec.minSize.width,
        viewport.width - NARROW_GUTTER * 2 - ICON_COLUMN,
      )
    : spec.size.width;

  return {
    id: spec.id,
    appId: spec.appId,
    title: spec.title,
    position: narrow ? spec.narrow : spec.wide,
    size: { width, height: spec.size.height },
    minSize: spec.minSize,
  };
}

/** The window that opens on load, plus the one behind it. Order sets the z-order. */
export const STARTUP_WINDOW_IDS: readonly ShellWindowId[] = [
  SHELL_WINDOW_IDS.paintProfile,
  SHELL_WINDOW_IDS.paintTools,
];
