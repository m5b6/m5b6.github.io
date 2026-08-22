import type {
  Point,
  Rect,
  Size,
  SizeConstraint,
  Viewport,
  WindowState,
} from "./types";

export const MENU_BAR_HEIGHT = 20;
export const TITLE_BAR_HEIGHT = 32;
export const MIN_WINDOW_WIDTH = 320;
export const MIN_WINDOW_HEIGHT = 120;
export const MIN_VISIBLE_EDGE = 72;

export const DEFAULT_WINDOW_SIZE: Size = { width: 420, height: 300 };
export const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 720 };

export const CASCADE_ORIGIN: Point = { x: 24, y: MENU_BAR_HEIGHT + 12 };
export const CASCADE_STEP: Point = { x: 24, y: 24 };
export const CASCADE_WRAP_STEP = 16;
export const CASCADE_WRAP_LIMIT = 4;

export function toFinite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}

export function normalizeViewport(viewport: Viewport): Viewport {
  return {
    width: Math.max(1, toFinite(viewport?.width, DEFAULT_VIEWPORT.width)),
    height: Math.max(1, toFinite(viewport?.height, DEFAULT_VIEWPORT.height)),
  };
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

export function effectiveHeight(window: Pick<WindowState, "height" | "collapsed">) {
  return window.collapsed ? TITLE_BAR_HEIGHT : window.height;
}

export function clampSize(
  size: Size,
  constraint: SizeConstraint,
  viewport: Viewport,
): Size {
  const minWidth = Math.max(1, Math.round(constraint.minWidth));
  const minHeight = Math.max(1, Math.round(constraint.minHeight));
  const maxWidth = Math.max(minWidth, viewport.width);
  const maxHeight = Math.max(minHeight, viewport.height - MENU_BAR_HEIGHT);

  return {
    width: clamp(toFinite(size.width, minWidth), minWidth, maxWidth),
    height: clamp(toFinite(size.height, minHeight), minHeight, maxHeight),
  };
}

export function originBounds(size: Size, viewport: Viewport) {
  const visible = Math.min(MIN_VISIBLE_EDGE, Math.max(1, size.width));

  return {
    minX: visible - size.width,
    maxX: viewport.width - visible,
    minY: MENU_BAR_HEIGHT,
    maxY: Math.max(MENU_BAR_HEIGHT, viewport.height - TITLE_BAR_HEIGHT),
  };
}

export function clampPosition(
  position: Point,
  size: Size,
  viewport: Viewport,
): Point {
  const bounds = originBounds(size, viewport);

  return {
    x: clamp(toFinite(position.x, bounds.minX), bounds.minX, bounds.maxX),
    y: clamp(toFinite(position.y, bounds.minY), bounds.minY, bounds.maxY),
  };
}

export function clampRect(
  rect: Rect,
  constraint: SizeConstraint,
  viewport: Viewport,
): Rect {
  const size = clampSize(rect, constraint, viewport);
  return { ...size, ...clampPosition(rect, size, viewport) };
}

export function isReachable(rect: Rect, viewport: Viewport) {
  const position = clampPosition(rect, rect, viewport);
  return position.x === rect.x && position.y === rect.y;
}

export function cascadeSlots(size: Size, viewport: Viewport) {
  const spanX = viewport.width - CASCADE_ORIGIN.x - size.width;
  const spanY = viewport.height - CASCADE_ORIGIN.y - size.height;
  const stepsX = Math.floor(Math.max(0, spanX) / CASCADE_STEP.x);
  const stepsY = Math.floor(Math.max(0, spanY) / CASCADE_STEP.y);

  return Math.max(1, Math.min(stepsX, stepsY) + 1);
}

export function cascadePosition(
  index: number,
  size: Size,
  viewport: Viewport,
): Point {
  const safeIndex = Math.max(0, toFinite(index, 0));
  const slots = cascadeSlots(size, viewport);
  const slot = safeIndex % slots;
  const wrap = Math.floor(safeIndex / slots) % CASCADE_WRAP_LIMIT;

  return clampPosition(
    {
      x: CASCADE_ORIGIN.x + slot * CASCADE_STEP.x + wrap * CASCADE_WRAP_STEP,
      y: CASCADE_ORIGIN.y + slot * CASCADE_STEP.y,
    },
    size,
    viewport,
  );
}
