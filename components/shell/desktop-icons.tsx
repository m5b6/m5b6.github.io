"use client";

import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { MacDesktopIcon, MacDesktopIcons, type MacIconName } from "@/components/mac";

export type ShellIconModel = {
  id: string;
  icon: MacIconName;
  label: string;
  onOpen: () => void;
};

export type ShellDesktopIconsProps = {
  icons: readonly ShellIconModel[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/**
 * D2: the icon well is pinned top-right and never leaves y=30..290, so the canvas under
 * it stays paintable. Single click selects, double click opens, Enter opens (DESIGN.md).
 */
export function ShellDesktopIcons({
  icons,
  selectedId,
  onSelect,
}: ShellDesktopIconsProps) {
  const region = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const slots = [
        ...(region.current?.querySelectorAll<HTMLButtonElement>(".mac-desktop-icon") ??
          []),
      ];
      const index = slots.findIndex((slot) => slot === document.activeElement);

      if (event.key === "Enter") {
        event.preventDefault();
        icons[index]?.onOpen();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (slots.length === 0) return;

      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (Math.max(0, index) + delta + slots.length) % slots.length;
      slots[next].focus();
      onSelect(icons[next]?.id ?? null);
    },
    [icons, onSelect],
  );

  return (
    <div ref={region} onKeyDown={handleKeyDown}>
      <MacDesktopIcons label="Desktop icons">
        {icons.map((icon) => (
          <div key={icon.id} className="shell-icon-slot">
            <MacDesktopIcon
              icon={icon.icon}
              label={icon.label}
              selected={selectedId === icon.id}
              onSelect={() => onSelect(icon.id)}
              onOpen={icon.onOpen}
            />
          </div>
        ))}
      </MacDesktopIcons>
    </div>
  );
}
