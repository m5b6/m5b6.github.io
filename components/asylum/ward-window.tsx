"use client";

import { useEffect } from "react";
import { useShellStore } from "@/components/shell/desktop-store";
import { ManagedWindow } from "@/components/shell/managed-window";
import {
  SHELL_WINDOW_IDS,
  openWindowInput,
  shellWindow,
} from "@/components/shell/windows";
import { useWardBoot } from "./ward-boot";
import { Ward } from "./ward";

/**
 * The asylum contributes window content and nothing else (D5). It opens itself
 * through the one window manager and stops watching the moment it is closed,
 * which is exactly what stops the ward.
 */
export function AsylumWardWindow() {
  const boot = useWardBoot();
  const store = useShellStore();
  const open = boot?.open ?? false;

  useEffect(() => {
    if (!open) return;
    store.dispatch({
      type: "open",
      window: openWindowInput(
        shellWindow(SHELL_WINDOW_IDS.ward),
        store.getState().viewport,
      ),
    });
  }, [open, store]);

  if (!boot) return null;

  return (
    <ManagedWindow id={SHELL_WINDOW_IDS.ward} paneClassName="ward-pane">
      <Ward voice={boot.voice} kind={boot.kind} />
    </ManagedWindow>
  );
}
