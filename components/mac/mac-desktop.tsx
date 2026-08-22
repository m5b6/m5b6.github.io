import type { ReactNode } from "react";
import { MacIcon, type MacIconName } from "./mac-icon";

export type MacDesktopProps = {
  pattern?: "none" | "dither";
  children: ReactNode;
  className?: string;
};

export function MacDesktop({ pattern = "none", children, className }: MacDesktopProps) {
  const classes = className ? `mac-desktop ${className}` : "mac-desktop";

  return (
    <div className={classes} data-pattern={pattern}>
      {pattern === "dither" ? <div className="mac-desktop-pattern" /> : null}
      {children}
    </div>
  );
}

export type MacDesktopSurfaceProps = {
  children: ReactNode;
};

export function MacDesktopSurface({ children }: MacDesktopSurfaceProps) {
  return <div className="mac-desktop-surface">{children}</div>;
}

export type MacDesktopIconsProps = {
  label?: string;
  children: ReactNode;
};

export function MacDesktopIcons({ label = "Desktop", children }: MacDesktopIconsProps) {
  return (
    <div className="mac-desktop-icons" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export type MacDesktopIconProps = {
  icon: MacIconName;
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
};

export function MacDesktopIcon({
  icon,
  label,
  selected = false,
  onSelect,
  onOpen,
}: MacDesktopIconProps) {
  return (
    <button
      type="button"
      className="mac-desktop-icon"
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <MacIcon name={icon} className="mac-desktop-icon-glyph" />
      <span className="mac-desktop-icon-label">{label}</span>
    </button>
  );
}
