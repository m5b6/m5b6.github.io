"use client";

import { PaintingExperience } from "@/components/painting-experience";
import type { ParticipantKind } from "@/lib/canvas";
import { ShellStoreProvider } from "./desktop-store";
import { PaintDesktop } from "./paint-desktop";

export type ShellProps = {
  initialKind: ParticipantKind;
  multiplayerEnabled: boolean;
};

/**
 * The whole Macintosh. One store, one desktop, one menu bar (D5).
 *
 * Nothing above <PaintDesktop> subscribes to the window manager, which is what keeps a
 * window drag from reaching the canvas: the drag re-renders the dragged window and
 * nothing else in the tree.
 */
export function Shell({ initialKind, multiplayerEnabled }: ShellProps) {
  return (
    <ShellStoreProvider>
      <PaintingExperience
        initialKind={initialKind}
        multiplayerEnabled={multiplayerEnabled}
        surface={PaintDesktop}
      />
    </ShellStoreProvider>
  );
}
