"use client";

import { useCallback, useMemo, useState } from "react";
import { MacAlert, MacButton } from "@/components/mac";
import {
  ClearCanvasAlert,
  PaintingCanvas,
  PaintingProfile,
  PaintingToolsPanel,
  usePaintShortcuts,
  usePaintTools,
} from "@/components/painting-surface";
import type { PaintSession } from "@/components/painting-experience";
import { APPS, PAINT_APP, type AppSpec } from "@/lib/apps/manifest";
import { useModalFocus } from "@/components/use-modal-focus";
import { describeTrash, totalTrashedPixels } from "@/lib/trash";
import { AboutPanel } from "./about-panel";
import { paintMenuActions, registryMenus } from "./app-menus";
import { useShellStore } from "./desktop-store";
import { Desktop } from "./desktop";
import type { ShellIconModel } from "./desktop-icons";
import { ManagedWindow } from "./managed-window";
import { APPLE_MENU_ID, type ShellMenuModel } from "./shell-menu-bar";
import { TrashPanel } from "./trash-panel";
import { useTrash } from "./use-trash";
import {
  SHELL_WINDOWS,
  SHELL_WINDOW_IDS,
  isNarrow,
  openWindowInput,
  shellWindow,
  type ShellWindowId,
} from "./windows";

const TRASH_ICON_ID = "trash";

/**
 * Paint, reconciled with the window manager honestly: the canvas is the desktop's
 * backdrop and is not a window at all, while Paint's palette and profile are real
 * managed windows floating above it.
 */
export function PaintDesktop({ session }: { session: PaintSession }) {
  const store = useShellStore();
  const tools = usePaintTools();
  const trash = useTrash(
    session.identity.id,
    session.identity.name,
    session.trashToken,
  );
  const [askingToClear, setAskingToClear] = useState(false);
  const [askingToEmpty, setAskingToEmpty] = useState(false);
  const [locked, setLocked] = useState<AppSpec | null>(null);

  const { entries: discarded, busy: trashBusy, putBack, empty } = trash;
  const pixelCount = Object.keys(session.pixels).length;
  const trashedPixels = totalTrashedPixels(discarded);

  usePaintShortcuts({ tools, onUndo: session.onUndo, onRedo: session.onRedo });

  const cancelClear = useCallback(() => setAskingToClear(false), []);
  const cancelEmpty = useCallback(() => setAskingToEmpty(false), []);
  const dismissLocked = useCallback(() => setLocked(null), []);
  useModalFocus(askingToEmpty, cancelEmpty);
  useModalFocus(locked !== null, dismissLocked);

  const openWindow = useCallback(
    (id: ShellWindowId) => {
      store.dispatch({
        type: "open",
        window: openWindowInput(shellWindow(id), store.getState().viewport),
      });
    },
    [store],
  );

  const cleanUp = useCallback(() => {
    const { viewport, windows } = store.getState();
    const narrow = isNarrow(viewport);

    for (const spec of SHELL_WINDOWS) {
      if (!windows[spec.id]) continue;
      store.dispatch({
        type: "resize",
        id: spec.id,
        size: openWindowInput(spec, viewport).size as { width: number; height: number },
        position: narrow ? spec.narrow : spec.wide,
      });
    }
  }, [store]);

  const openApp = useCallback(
    (app: AppSpec) => {
      if (app.status !== "live") {
        setLocked(app);
        return;
      }
      openWindow(SHELL_WINDOW_IDS.paintTools);
    },
    [openWindow],
  );

  const menus = useMemo<ShellMenuModel[]>(() => {
    const appleEntries = [
      {
        kind: "item" as const,
        id: "apple.about",
        label: "About This Macintosh…",
        onSelect: () => openWindow(SHELL_WINDOW_IDS.about),
      },
      { kind: "separator" as const, id: "apple.sep" },
      ...APPS.map((app) => ({
        kind: "item" as const,
        id: `apple.${app.id}`,
        label: app.title,
        disabled: app.status !== "live",
        onSelect: () => openApp(app),
      })),
      { kind: "separator" as const, id: "apple.sep2" },
      {
        kind: "item" as const,
        id: "apple.trash",
        label: "Trash",
        onSelect: () => openWindow(SHELL_WINDOW_IDS.trash),
      },
    ];

    const fileEntries = [
      {
        kind: "item" as const,
        id: "file.profile",
        label: "Open Matias Berrios",
        onSelect: () => openWindow(SHELL_WINDOW_IDS.paintProfile),
      },
      {
        kind: "item" as const,
        id: "file.trash",
        label: "Open Trash",
        onSelect: () => openWindow(SHELL_WINDOW_IDS.trash),
      },
      { kind: "separator" as const, id: "file.sep" },
      {
        kind: "item" as const,
        id: "file.putback",
        label: "Put Back",
        disabled: discarded.length === 0 || trashBusy,
        onSelect: () => void putBack(),
      },
    ];

    const specialEntries = [
      {
        kind: "item" as const,
        id: "special.cleanup",
        label: "Clean Up Desktop",
        onSelect: cleanUp,
      },
      { kind: "separator" as const, id: "special.sep" },
      {
        kind: "item" as const,
        id: "special.empty",
        label: "Empty Trash…",
        disabled: discarded.length === 0 || trashBusy,
        onSelect: () => setAskingToEmpty(true),
      },
    ];

    return [
      { id: APPLE_MENU_ID, title: "Apple", label: "Apple", entries: appleEntries },
      { id: "file", title: "File", entries: fileEntries },
      ...registryMenus(
        paintMenuActions({
          canUndo: session.canUndo,
          canRedo: session.canRedo,
          pixelCount,
          eraserActive: tools.selectedColor === "transparent",
          rainbow: tools.rainbow,
          mirror: tools.mirror,
          undo: session.onUndo,
          redo: session.onRedo,
          cycleBrush: tools.cycleBrush,
          chooseEraser: tools.chooseEraser,
          toggleRainbow: tools.toggleRainbow,
          toggleMirror: tools.toggleMirror,
          requestClear: () => setAskingToClear(true),
        }),
      ),
      { id: "special", title: "Special", entries: specialEntries },
    ];
  }, [
    cleanUp,
    discarded.length,
    openApp,
    openWindow,
    pixelCount,
    putBack,
    session.canRedo,
    session.canUndo,
    session.onRedo,
    session.onUndo,
    tools,
    trashBusy,
  ]);

  const icons = useMemo<ShellIconModel[]>(
    () => [
      ...APPS.map((app) => ({
        id: app.id,
        icon: app.icon,
        label: app.title,
        onOpen: () => openApp(app),
      })),
      {
        id: TRASH_ICON_ID,
        icon: discarded.length > 0 ? ("trash-full" as const) : ("trash" as const),
        label: "Trash",
        onOpen: () => openWindow(SHELL_WINDOW_IDS.trash),
      },
    ],
    [discarded.length, openApp, openWindow],
  );

  return (
    <>
      <PaintingCanvas
        pixels={session.pixels}
        participants={session.participants}
        tools={tools}
        onCursorChange={session.onCursorChange}
        onStrokeStart={session.onStrokeStart}
        onPaintPixel={session.onPaintPixel}
        onStrokeEnd={session.onStrokeEnd}
      />

      <Desktop
        menus={menus}
        icons={icons}
        overlay={
          <>
            <ClearCanvasAlert
              open={askingToClear}
              pixelCount={pixelCount}
              onCancel={cancelClear}
              onConfirm={() => {
                setAskingToClear(false);
                session.onClear();
              }}
            />
            <MacAlert
              open={askingToEmpty}
              kind="stop"
              label="Empty the Trash"
              actions={
                <>
                  <MacButton variant="default" onClick={cancelEmpty}>
                    Cancel
                  </MacButton>
                  <MacButton
                    onClick={() => {
                      setAskingToEmpty(false);
                      void empty();
                    }}
                  >
                    Empty Trash
                  </MacButton>
                </>
              }
            >
              {describeTrash(discarded)} will be destroyed. This cannot be undone.
            </MacAlert>
            <MacAlert
              open={locked !== null}
              kind="note"
              label="Not open yet"
              actions={
                <MacButton variant="default" onClick={dismissLocked}>
                  OK
                </MacButton>
              }
            >
              {locked?.title} has not opened yet. {PAINT_APP.title} is the only
              application on this Macintosh today.
            </MacAlert>
          </>
        }
      >
        <ManagedWindow id={SHELL_WINDOW_IDS.paintProfile} className="profile-window">
          <PaintingProfile />
        </ManagedWindow>

        <ManagedWindow id={SHELL_WINDOW_IDS.paintTools} className="palette-window">
          <PaintingToolsPanel
            tools={tools}
            onlineCount={session.onlineCount}
            status={session.status}
            pixelCount={pixelCount}
            setupNotice={session.setupNotice}
            onUndo={session.onUndo}
            onRedo={session.onRedo}
            onRequestClear={() => setAskingToClear(true)}
            canUndo={session.canUndo}
            canRedo={session.canRedo}
          />
        </ManagedWindow>

        <ManagedWindow
          id={SHELL_WINDOW_IDS.trash}
          status={describeTrash(discarded)}
        >
          <TrashPanel trash={trash} onRequestEmpty={() => setAskingToEmpty(true)} />
        </ManagedWindow>

        <ManagedWindow id={SHELL_WINDOW_IDS.about}>
          <AboutPanel
            paintedCount={pixelCount}
            trashedCount={trashedPixels}
            onlineCount={session.onlineCount}
          />
        </ManagedWindow>
      </Desktop>
    </>
  );
}
