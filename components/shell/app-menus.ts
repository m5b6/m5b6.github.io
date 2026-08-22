import { menuContributions, type MenuSpec } from "@/lib/apps/manifest";
import type { ShellMenuEntry, ShellMenuModel } from "./shell-menu-bar";

export type MenuAction = {
  onSelect?: () => void;
  disabled?: boolean;
  checked?: boolean;
};

export type MenuActions = Readonly<Record<string, MenuAction>>;

export type PaintMenuContext = {
  canUndo: boolean;
  canRedo: boolean;
  pixelCount: number;
  eraserActive: boolean;
  rainbow: boolean;
  mirror: boolean;
  undo: () => void;
  redo: () => void;
  cycleBrush: () => void;
  chooseEraser: () => void;
  toggleRainbow: () => void;
  toggleMirror: () => void;
  requestClear: () => void;
};

/** Keyed by the item ids in lib/apps/manifest.ts. The registry decides what exists (D3). */
export function paintMenuActions(context: PaintMenuContext): MenuActions {
  return {
    "paint.undo": { onSelect: context.undo, disabled: !context.canUndo },
    "paint.redo": { onSelect: context.redo, disabled: !context.canRedo },
    "paint.brush": { onSelect: context.cycleBrush },
    "paint.eraser": {
      onSelect: context.chooseEraser,
      checked: context.eraserActive,
    },
    "paint.rainbow": {
      onSelect: context.toggleRainbow,
      checked: context.rainbow,
    },
    "paint.mirror": { onSelect: context.toggleMirror, checked: context.mirror },
    "paint.clear": {
      onSelect: context.requestClear,
      disabled: context.pixelCount === 0,
    },
  };
}

function toEntries(spec: MenuSpec, actions: MenuActions): ShellMenuEntry[] {
  return spec.items.map((item) => {
    const action = actions[item.id];

    return {
      kind: "item",
      id: item.id,
      label: item.label,
      shortcut: item.shortcut,
      disabled: action ? action.disabled === true : true,
      checked: action?.checked,
      onSelect: action?.onSelect,
    };
  });
}

/** The per-application menus, rendered from the registry rather than a hand-written list. */
export function registryMenus(
  actions: MenuActions,
  specs: readonly MenuSpec[] = menuContributions(),
): ShellMenuModel[] {
  return specs.map((spec) => ({
    id: spec.id,
    title: spec.title,
    entries: toEntries(spec, actions),
  }));
}

/** Every registry menu item must be wired. The test on this is what stops silent drift. */
export function unhandledMenuItemIds(
  actions: MenuActions,
  specs: readonly MenuSpec[] = menuContributions(),
) {
  return specs
    .flatMap((spec) => spec.items)
    .filter((item) => !(item.id in actions))
    .map((item) => item.id);
}
