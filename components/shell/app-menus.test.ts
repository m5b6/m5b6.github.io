import { describe, expect, it, vi } from "vitest";
import { menuContributions } from "@/lib/apps/manifest";
import {
  paintMenuActions,
  registryMenus,
  unhandledMenuItemIds,
  type PaintMenuContext,
} from "./app-menus";

function context(overrides: Partial<PaintMenuContext> = {}): PaintMenuContext {
  return {
    canUndo: true,
    canRedo: true,
    pixelCount: 12,
    eraserActive: false,
    rainbow: false,
    mirror: false,
    undo: vi.fn(),
    redo: vi.fn(),
    cycleBrush: vi.fn(),
    chooseEraser: vi.fn(),
    toggleRainbow: vi.fn(),
    toggleMirror: vi.fn(),
    requestClear: vi.fn(),
    ...overrides,
  };
}

describe("the menu bar renders from the registry (D3)", () => {
  it("wires every menu item the registry declares", () => {
    expect(unhandledMenuItemIds(paintMenuActions(context()))).toEqual([]);
  });

  it("keeps the registry's labels, order and shortcuts", () => {
    const menus = registryMenus(paintMenuActions(context()));
    const specs = menuContributions();

    expect(menus.map((menu) => menu.id)).toEqual(specs.map((spec) => spec.id));
    for (const [index, menu] of menus.entries()) {
      expect(menu.entries.map((entry) => entry.id)).toEqual(
        specs[index].items.map((item) => item.id),
      );
      expect(
        menu.entries.map((entry) => (entry.kind === "item" ? entry.shortcut : null)),
      ).toEqual(specs[index].items.map((item) => item.shortcut));
    }
  });

  it("disables an item the registry declares but nothing handles", () => {
    const menus = registryMenus(
      {},
      [{ id: "ghost", title: "Ghost", items: [{ id: "ghost.item", label: "Boo" }] }],
    );
    const entry = menus[0].entries[0];
    expect(entry.kind === "item" && entry.disabled).toBe(true);
  });

  it("greys Undo, Redo and Clear when there is nothing to act on", () => {
    const menus = registryMenus(
      paintMenuActions(context({ canUndo: false, canRedo: false, pixelCount: 0 })),
    );
    const disabled = menus
      .flatMap((menu) => menu.entries)
      .filter((entry) => entry.kind === "item" && entry.disabled)
      .map((entry) => entry.id);

    expect(disabled).toEqual(["paint.undo", "paint.redo", "paint.clear"]);
  });

  it("checks the modes that are switched on", () => {
    const menus = registryMenus(
      paintMenuActions(context({ rainbow: true, mirror: true, eraserActive: true })),
    );
    const checked = menus
      .flatMap((menu) => menu.entries)
      .filter((entry) => entry.kind === "item" && entry.checked)
      .map((entry) => entry.id);

    expect(checked).toEqual(["paint.eraser", "paint.rainbow", "paint.mirror"]);
  });

  it("runs the handler the registry item is bound to", () => {
    const requestClear = vi.fn();
    const actions = paintMenuActions(context({ requestClear }));
    actions["paint.clear"].onSelect?.();
    expect(requestClear).toHaveBeenCalledOnce();
  });
});
