"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  MacAppleIcon,
  MacMenu,
  MacMenuBar,
  MacMenuItem,
  MacMenuSeparator,
} from "@/components/mac";

export type ShellMenuEntry =
  | {
      kind: "item";
      id: string;
      label: string;
      shortcut?: string;
      disabled?: boolean;
      checked?: boolean;
      onSelect?: () => void;
    }
  | { kind: "separator"; id: string };

export type ShellMenuModel = {
  id: string;
  title: ReactNode;
  label?: string;
  disabled?: boolean;
  entries: readonly ShellMenuEntry[];
};

export const APPLE_MENU_ID = "apple";

export type ShellMenuBarProps = {
  menus: readonly ShellMenuModel[];
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  clock?: ReactNode;
};

function menuRoots(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>('li[role="menu-item"][aria-haspopup="true"]'),
  ];
}

function titleOf(menu: HTMLElement | undefined) {
  return menu?.querySelector<HTMLButtonElement>(".mac-menu-title") ?? null;
}

function enabledItems(menu: HTMLElement | undefined) {
  if (!menu) return [];
  return [
    ...menu.querySelectorAll<HTMLButtonElement>(".mac-menu > li > button"),
  ].filter((button) => !button.disabled);
}

/**
 * The menu bar is at the top of the screen, opens on click, and stays open (DESIGN.md).
 * system.css ships no keyboard model at all, so the shell adds one: arrows walk the bar
 * and the open menu, Escape closes and returns focus to the title that opened it.
 */
export function ShellMenuBar({
  menus,
  openId,
  onOpenChange,
  clock,
}: ShellMenuBarProps) {
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;

    const close = (event: Event) => {
      const root = region.current;
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      onOpenChange(null);
    };

    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [onOpenChange, openId]);

  const indexOf = useCallback(
    (id: string | null) => menus.findIndex((menu) => menu.id === id),
    [menus],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const root = region.current;
      if (!root) return;

      const roots = menuRoots(root);
      const open = openId;
      const openIndex = indexOf(open);
      const active = document.activeElement;
      const onTitle =
        active instanceof HTMLElement && active.classList.contains("mac-menu-title");
      const items = openIndex < 0 ? [] : enabledItems(roots[openIndex]);

      const focusItem = (index: number) => {
        requestAnimationFrame(() => enabledItems(roots[index])[0]?.focus());
      };

      switch (event.key) {
        case "ArrowRight":
        case "ArrowLeft": {
          event.preventDefault();
          const delta = event.key === "ArrowRight" ? 1 : -1;
          const from = onTitle
            ? roots.findIndex((entry) => entry.contains(active))
            : openIndex;
          if (roots.length === 0) return;

          let next = from < 0 ? 0 : from;
          for (let hop = 0; hop < roots.length; hop += 1) {
            next = (next + delta + roots.length) % roots.length;
            if (!menus[next]?.disabled) break;
          }

          if (open) {
            onOpenChange(menus[next].id);
            titleOf(roots[next])?.focus();
          } else {
            titleOf(roots[next])?.focus();
          }
          return;
        }

        case "ArrowDown": {
          event.preventDefault();
          if (onTitle) {
            const index = roots.findIndex((entry) => entry.contains(active));
            if (index < 0 || menus[index]?.disabled) return;
            if (open !== menus[index].id) onOpenChange(menus[index].id);
            focusItem(index);
            return;
          }
          if (items.length === 0) return;
          const position = items.findIndex((entry) => entry === active);
          items[(position + 1 + items.length) % items.length]?.focus();
          return;
        }

        case "ArrowUp": {
          event.preventDefault();
          if (onTitle || items.length === 0) return;
          const position = items.findIndex((entry) => entry === active);
          if (position <= 0) {
            titleOf(roots[openIndex])?.focus();
            return;
          }
          items[position - 1].focus();
          return;
        }

        case "Home":
        case "End": {
          if (onTitle || items.length === 0) return;
          event.preventDefault();
          (event.key === "Home" ? items[0] : items[items.length - 1]).focus();
          return;
        }

        case "Escape": {
          if (!open) return;
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(null);
          titleOf(roots[openIndex])?.focus();
          return;
        }

        default:
          return;
      }
    },
    [indexOf, menus, onOpenChange, openId],
  );

  return (
    <div className="shell-menu-region" ref={region} onKeyDown={handleKeyDown}>
      <MacMenuBar>
        {menus.map((menu) => (
          <MacMenu
            key={menu.id}
            title={menu.id === APPLE_MENU_ID ? <MacAppleIcon /> : menu.title}
            label={menu.label}
            disabled={menu.disabled}
            open={openId === menu.id}
            onToggle={() => onOpenChange(openId === menu.id ? null : menu.id)}
            onPointerEnter={() => {
              if (openId && !menu.disabled) onOpenChange(menu.id);
            }}
          >
            {menu.entries.map((entry) =>
              entry.kind === "separator" ? (
                <MacMenuSeparator key={entry.id} />
              ) : (
                <MacMenuItem
                  key={entry.id}
                  label={entry.label}
                  shortcut={entry.shortcut}
                  disabled={entry.disabled}
                  checked={entry.checked}
                  onSelect={() => {
                    onOpenChange(null);
                    entry.onSelect?.();
                  }}
                />
              ),
            )}
          </MacMenu>
        ))}
        <li className="shell-menu-spacer" aria-hidden="true" />
        {clock ? <li className="shell-clock">{clock}</li> : null}
      </MacMenuBar>
    </div>
  );
}
