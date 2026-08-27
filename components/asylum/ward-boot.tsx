"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SpectatorKind } from "./use-ward";

/**
 * D9. There is no key, the provider is unwritten, and every turn in Ward 7 is
 * dreamed from a seed. The window is told which it is so the dream can be
 * declared rather than discovered.
 */
export type WardVoice = "dream" | "model";

export type WardBoot = {
  /** The route asked for the ward, so the window manager opens it on arrival. */
  open: boolean;
  voice: WardVoice;
  kind: SpectatorKind;
};

const WardBootContext = createContext<WardBoot | null>(null);

export type WardBootProviderProps = {
  boot: WardBoot | null;
  children: ReactNode;
};

export function WardBootProvider({ boot, children }: WardBootProviderProps) {
  const value = useMemo(
    () => (boot ? { open: boot.open, voice: boot.voice, kind: boot.kind } : null),
    [boot],
  );

  return (
    <WardBootContext.Provider value={value}>{children}</WardBootContext.Provider>
  );
}

export function useWardBoot() {
  return useContext(WardBootContext);
}
