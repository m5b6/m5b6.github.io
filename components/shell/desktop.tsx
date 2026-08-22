"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { MacDesktop } from "@/components/mac";
import { ShellDesktopIcons, type ShellIconModel } from "./desktop-icons";
import { ShellClock } from "./shell-clock";
import { ShellMenuBar, type ShellMenuModel } from "./shell-menu-bar";

export type DesktopProps = {
  menus: readonly ShellMenuModel[];
  icons: readonly ShellIconModel[];
  /** Modal layers, rendered above the menu bar the way a Macintosh alert is. */
  overlay?: ReactNode;
  /** The managed windows. Each one decides for itself whether it is open. */
  children: ReactNode;
};

/**
 * One desktop, one menu bar, one window manager (D5). The desktop layer does not paint a
 * pattern of its own: the shared canvas underneath it is the desktop pattern, and the
 * layer stays pointer-transparent so every unclaimed pixel still reaches the painting (D2).
 */
export function Desktop({ menus, icons, overlay, children }: DesktopProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);

  const deselect = useCallback(() => setSelectedIconId(null), []);

  useEffect(() => {
    if (!selectedIconId) return;

    const clear = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mac-desktop-icon")) return;
      deselect();
    };

    window.addEventListener("pointerdown", clear);
    return () => window.removeEventListener("pointerdown", clear);
  }, [deselect, selectedIconId]);

  return (
    <MacDesktop pattern="none" className="shell-desktop">
      <ShellMenuBar
        menus={menus}
        openId={openMenuId}
        onOpenChange={setOpenMenuId}
        clock={<ShellClock />}
      />
      <ShellDesktopIcons
        icons={icons}
        selectedId={selectedIconId}
        onSelect={setSelectedIconId}
      />
      <div className="shell-window-layer">{children}</div>
      {overlay}
    </MacDesktop>
  );
}
