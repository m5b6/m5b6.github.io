"use client";

import { useEffect } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * system.css draws a modal; it does not behave like one. This gives <MacAlert> and
 * <MacDialog> the rest of the contract: focus moves in, Tab cannot leave, Escape is the
 * Cancel key, and focus returns to whatever opened the alert.
 *
 * `onDismiss` must be stable, or the alert re-takes focus on every render.
 */
export function useModalFocus(open: boolean, onDismiss?: () => void) {
  useEffect(() => {
    if (!open) return;

    const layer = document.querySelector<HTMLElement>(".mac-dialog-layer");
    if (!layer) return;

    const previous = document.activeElement;
    const focusable = () => [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)];
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss?.();
        return;
      }

      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      items[(Math.max(0, index) + step + items.length) % items.length].focus();
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [onDismiss, open]);
}
