"use client";

import { WardBootProvider, type WardBoot } from "@/components/asylum";
import { PaintingExperience } from "@/components/painting-experience";
import type { ParticipantKind } from "@/lib/canvas";
import { ShellStoreProvider } from "./desktop-store";
import { PaintDesktop } from "./paint-desktop";

export type ShellProps = {
  initialKind: ParticipantKind;
  multiplayerEnabled: boolean;
  /** Present only on the asylum's own route, which is what opens Ward 7. */
  ward?: WardBoot | null;
};

/**
 * The whole Macintosh. One store, one desktop, one menu bar (D5).
 *
 * Nothing above <PaintDesktop> subscribes to the window manager, which is what keeps a
 * window drag from reaching the canvas: the drag re-renders the dragged window and
 * nothing else in the tree.
 */
export function Shell({ initialKind, multiplayerEnabled, ward = null }: ShellProps) {
  return (
    <ShellStoreProvider>
      <WardBootProvider boot={ward}>
        <PaintingExperience
          initialKind={initialKind}
          multiplayerEnabled={multiplayerEnabled}
          surface={PaintDesktop}
        />
      </WardBootProvider>
    </ShellStoreProvider>
  );
}
