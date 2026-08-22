import {
  DEFAULT_VIEWPORT,
  DEFAULT_WINDOW_SIZE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  cascadePosition,
  clampPosition,
  clampSize,
  normalizeViewport,
  toFinite,
} from "./geometry";
import type {
  DesktopAction,
  DesktopState,
  OpenWindowInput,
  Viewport,
  WindowId,
  WindowState,
} from "./types";

export const WINDOW_Z_BASE = 100;
export const MAX_WINDOWS = 24;

export function createDesktopState(
  viewport: Viewport = DEFAULT_VIEWPORT,
): DesktopState {
  return {
    windows: {},
    order: [],
    focusedId: null,
    viewport: normalizeViewport(viewport),
    cascadeIndex: 0,
  };
}

function reorder(
  state: DesktopState,
  nextOrder: readonly WindowId[],
  nextFocusedId: WindowId | null,
): DesktopState {
  const windows: Record<WindowId, WindowState> = {};
  const focusedId =
    nextFocusedId !== null && nextOrder.includes(nextFocusedId)
      ? nextFocusedId
      : null;

  let sameOrder = nextOrder.length === state.order.length;
  let changed = false;

  for (let index = 0; index < nextOrder.length; index += 1) {
    const id = nextOrder[index];
    if (id !== state.order[index]) sameOrder = false;

    const current = state.windows[id];
    const zIndex = WINDOW_Z_BASE + index;
    const focused = id === focusedId;

    if (current.zIndex === zIndex && current.focused === focused) {
      windows[id] = current;
    } else {
      windows[id] = { ...current, zIndex, focused };
      changed = true;
    }
  }

  if (
    sameOrder &&
    !changed &&
    focusedId === state.focusedId &&
    Object.keys(state.windows).length === nextOrder.length
  ) {
    return state;
  }

  return {
    ...state,
    windows,
    order: sameOrder ? state.order : nextOrder,
    focusedId,
  };
}

function raise(state: DesktopState, id: WindowId, takeFocus: boolean) {
  if (!state.windows[id]) return state;

  const nextOrder = state.order.filter((candidate) => candidate !== id);
  nextOrder.push(id);

  return reorder(state, nextOrder, takeFocus ? id : state.focusedId);
}

function closeWindow(state: DesktopState, id: WindowId) {
  if (!state.windows[id]) return state;

  const windows = { ...state.windows };
  delete windows[id];

  const nextOrder = state.order.filter((candidate) => candidate !== id);
  const focusedId =
    state.focusedId === id
      ? (nextOrder[nextOrder.length - 1] ?? null)
      : state.focusedId;

  return reorder({ ...state, windows }, nextOrder, focusedId);
}

function openWindow(state: DesktopState, input: OpenWindowInput) {
  if (state.windows[input.id]) return raise(state, input.id, true);

  const base =
    state.order.length >= MAX_WINDOWS
      ? closeWindow(state, state.order[0])
      : state;

  const minWidth = toFinite(input.minSize?.width, MIN_WINDOW_WIDTH);
  const minHeight = toFinite(input.minSize?.height, MIN_WINDOW_HEIGHT);
  const size = clampSize(
    {
      width: toFinite(input.size?.width, DEFAULT_WINDOW_SIZE.width),
      height: toFinite(input.size?.height, DEFAULT_WINDOW_SIZE.height),
    },
    { minWidth, minHeight },
    base.viewport,
  );
  const position = clampPosition(
    input.position ?? cascadePosition(base.cascadeIndex, size, base.viewport),
    size,
    base.viewport,
  );

  const created: WindowState = {
    id: input.id,
    appId: input.appId,
    title: input.title,
    ...position,
    ...size,
    minWidth,
    minHeight,
    zIndex: WINDOW_Z_BASE,
    collapsed: input.collapsed === true,
    focused: false,
  };

  return reorder(
    {
      ...base,
      windows: { ...base.windows, [input.id]: created },
      cascadeIndex: base.cascadeIndex + 1,
    },
    [...base.order, input.id],
    input.id,
  );
}

function replaceWindow(state: DesktopState, next: WindowState): DesktopState {
  return { ...state, windows: { ...state.windows, [next.id]: next } };
}

function applyViewport(state: DesktopState, viewport: Viewport) {
  const next = normalizeViewport(viewport);
  if (
    next.width === state.viewport.width &&
    next.height === state.viewport.height
  ) {
    return state;
  }

  const windows: Record<WindowId, WindowState> = {};
  for (const id of state.order) {
    const current = state.windows[id];
    const size = clampSize(current, current, next);
    const position = clampPosition(current, size, next);
    windows[id] =
      size.width === current.width &&
      size.height === current.height &&
      position.x === current.x &&
      position.y === current.y
        ? current
        : { ...current, ...size, ...position };
  }

  return { ...state, viewport: next, windows };
}

export function desktopReducer(
  state: DesktopState,
  action: DesktopAction,
): DesktopState {
  switch (action.type) {
    case "open":
      return openWindow(state, action.window);

    case "close":
      return closeWindow(state, action.id);

    case "focus":
      return raise(state, action.id, true);

    case "bringToFront":
      return raise(state, action.id, false);

    case "move": {
      const current = state.windows[action.id];
      if (!current) return state;

      const position = clampPosition(
        {
          x: toFinite(action.position?.x, current.x),
          y: toFinite(action.position?.y, current.y),
        },
        current,
        state.viewport,
      );
      if (position.x === current.x && position.y === current.y) return state;

      return replaceWindow(state, { ...current, ...position });
    }

    case "resize": {
      const current = state.windows[action.id];
      if (!current) return state;

      const size = clampSize(
        {
          width: toFinite(action.size?.width, current.width),
          height: toFinite(action.size?.height, current.height),
        },
        current,
        state.viewport,
      );
      const position = clampPosition(
        {
          x: toFinite(action.position?.x, current.x),
          y: toFinite(action.position?.y, current.y),
        },
        size,
        state.viewport,
      );
      if (
        size.width === current.width &&
        size.height === current.height &&
        position.x === current.x &&
        position.y === current.y
      ) {
        return state;
      }

      return replaceWindow(state, { ...current, ...size, ...position });
    }

    case "collapse": {
      const current = state.windows[action.id];
      if (!current) return state;

      const collapsed = action.collapsed ?? !current.collapsed;
      if (collapsed === current.collapsed) return state;

      const next = { ...current, collapsed };
      return replaceWindow(state, {
        ...next,
        ...clampPosition(next, next, state.viewport),
      });
    }

    case "viewport":
      return applyViewport(state, action.viewport);

    default:
      return state;
  }
}

export function windowsInOrder(state: DesktopState) {
  return state.order.map((id) => state.windows[id]);
}

export function topWindowId(state: DesktopState) {
  return state.order[state.order.length - 1] ?? null;
}
