import type { ReactNode } from "react";

export type MacMenuBarProps = {
  children: ReactNode;
  className?: string;
};

export function MacMenuBar({ children, className }: MacMenuBarProps) {
  const classes = className ? `mac-menu-bar ${className}` : "mac-menu-bar";

  return (
    <ul role="menu-bar" className={classes}>
      {children}
    </ul>
  );
}

export type MacMenuProps = {
  title: ReactNode;
  label?: string;
  open?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onPointerEnter?: () => void;
  children: ReactNode;
};

export function MacMenu({
  title,
  label,
  open = false,
  disabled = false,
  onToggle,
  onPointerEnter,
  children,
}: MacMenuProps) {
  return (
    <li
      role="menu-item"
      aria-haspopup="true"
      data-open={open ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      onPointerEnter={onPointerEnter}
    >
      <button
        type="button"
        className="mac-menu-title"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
      >
        {title}
      </button>
      <ul role="menu" className="mac-menu">
        {children}
      </ul>
    </li>
  );
}

export type MacMenuItemProps = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  onSelect?: () => void;
};

export function MacMenuItem({
  label,
  shortcut,
  disabled = false,
  checked = false,
  onSelect,
}: MacMenuItemProps) {
  return (
    <li role="menu-item">
      <button
        type="button"
        disabled={disabled}
        aria-checked={checked ? true : undefined}
        role={checked ? "menuitemcheckbox" : undefined}
        onClick={onSelect}
      >
        <span>
          <span className="mac-menu-check" aria-hidden="true">
            {checked ? "✓" : ""}
          </span>
          {label}
        </span>
        {shortcut ? <span className="mac-menu-shortcut">{shortcut}</span> : null}
      </button>
    </li>
  );
}

export function MacMenuSeparator() {
  return <li role="separator" className="divider mac-menu-divider" />;
}

export function MacAppleIcon() {
  return <span className="apple" aria-hidden="true" />;
}
