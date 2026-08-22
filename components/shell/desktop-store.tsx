"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_VIEWPORT } from "@/lib/wm/geometry";
import {
  DesktopStoreContext,
  attachLayoutPersistence,
  createDesktopStore,
  useDesktopStore,
  type DesktopStore,
} from "@/lib/wm/store";
import type { Viewport } from "@/lib/wm/types";
import { STARTUP_WINDOW_IDS, openWindowInput, shellWindow } from "./windows";

export function readViewport(): Viewport {
  if (typeof window === "undefined") return DEFAULT_VIEWPORT;
  return { width: window.innerWidth, height: window.innerHeight };
}

export type ShellStoreProviderProps = {
  store?: DesktopStore;
  children: ReactNode;
};

/**
 * One store, one desktop, sitewide (D5). The provider owns the boot order the window
 * manager cannot own for itself: measure the screen, restore the saved layout, re-clamp
 * it against the screen, then launch the suggested app.
 */
export function ShellStoreProvider({ store, children }: ShellStoreProviderProps) {
  const [desktop] = useState(
    () => store ?? createDesktopStore({ viewport: readViewport() }),
  );

  useEffect(() => {
    desktop.dispatch({ type: "viewport", viewport: readViewport() });
    const detach = attachLayoutPersistence(desktop);
    desktop.dispatch({ type: "viewport", viewport: readViewport() });

    for (const id of STARTUP_WINDOW_IDS) {
      desktop.dispatch({
        type: "open",
        window: openWindowInput(shellWindow(id), desktop.getState().viewport),
      });
    }

    const sync = () =>
      desktop.dispatch({ type: "viewport", viewport: readViewport() });
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      detach();
    };
  }, [desktop]);

  return (
    <DesktopStoreContext.Provider value={desktop}>
      {children}
    </DesktopStoreContext.Provider>
  );
}

export function useShellStore() {
  return useDesktopStore();
}
