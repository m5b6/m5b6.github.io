"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { MacWindow, MacWindowPane } from "@/components/mac";
import { MENU_BAR_HEIGHT } from "@/lib/wm/geometry";
import { useWindow } from "@/lib/wm/store";
import type { Rect } from "@/lib/wm/types";
import { useShellStore } from "./desktop-store";
import type { ShellWindowId } from "./windows";

const ZOOM_GUTTER = 12;

type Gesture = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type ManagedWindowProps = {
  id: ShellWindowId;
  className?: string;
  paneClassName?: string;
  status?: ReactNode;
  resizable?: boolean;
  children: ReactNode;
};

/**
 * A window the reducer owns. The component wears the rect it is given and reports
 * gestures back as actions; it never stores position, size or z-order itself.
 * Only this component subscribes to the window, so a drag re-renders nothing else —
 * least of all the canvas, which is not in this subtree at all.
 */
export function ManagedWindow({
  id,
  className,
  paneClassName,
  status,
  resizable = true,
  children,
}: ManagedWindowProps) {
  const store = useShellStore();
  const state = useWindow(store, id);
  const drag = useRef<Gesture | null>(null);
  const resize = useRef<Gesture | null>(null);
  const zoomed = useRef<Rect | null>(null);

  const focus = useCallback(() => store.dispatch({ type: "focus", id }), [id, store]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const current = store.getWindow(id);
      if (!current) return;

      store.dispatch({ type: "focus", id });
      drag.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - current.x,
        offsetY: event.clientY - current.y,
        width: current.width,
        height: current.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [id, store],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = drag.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      store.dispatch({
        type: "move",
        id,
        position: {
          x: event.clientX - gesture.offsetX,
          y: event.clientY - gesture.offsetY,
        },
      });
    },
    [id, store],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const current = store.getWindow(id);
      if (!current) return;

      store.dispatch({ type: "focus", id });
      resize.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - current.width,
        offsetY: event.clientY - current.height,
        width: current.width,
        height: current.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [id, store],
  );

  const moveResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = resize.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      store.dispatch({
        type: "resize",
        id,
        size: {
          width: event.clientX - gesture.offsetX,
          height: event.clientY - gesture.offsetY,
        },
      });
    },
    [id, store],
  );

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const zoom = useCallback(() => {
    const current = store.getWindow(id);
    if (!current) return;

    const previous = zoomed.current;
    zoomed.current = previous
      ? null
      : { x: current.x, y: current.y, width: current.width, height: current.height };

    const { viewport } = store.getState();
    const target: Rect = previous ?? {
      x: ZOOM_GUTTER,
      y: MENU_BAR_HEIGHT + ZOOM_GUTTER,
      width: viewport.width - ZOOM_GUTTER * 2,
      height: viewport.height - MENU_BAR_HEIGHT - ZOOM_GUTTER * 2,
    };

    store.dispatch({
      type: "resize",
      id,
      size: { width: target.width, height: target.height },
      position: { x: target.x, y: target.y },
    });
  }, [id, store]);

  if (!state) return null;

  return (
    <MacWindow
      title={state.title}
      className={className}
      active={state.focused}
      collapsed={state.collapsed}
      status={status}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.zIndex,
      }}
      onPointerDownCapture={focus}
      onClose={() => store.dispatch({ type: "close", id })}
      onCollapse={() => store.dispatch({ type: "collapse", id })}
      onZoom={zoom}
      dragHandleProps={{
        onPointerDown: startDrag,
        onPointerMove: moveDrag,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onDoubleClick: () => store.dispatch({ type: "collapse", id }),
      }}
      resizeHandleProps={
        resizable
          ? {
              onPointerDown: startResize,
              onPointerMove: moveResize,
              onPointerUp: endResize,
              onPointerCancel: endResize,
            }
          : undefined
      }
    >
      <MacWindowPane className={paneClassName}>{children}</MacWindowPane>
    </MacWindow>
  );
}
