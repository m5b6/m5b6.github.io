import "@/styles/shell.css";

export { Shell, type ShellProps } from "./shell";
export { Desktop, type DesktopProps } from "./desktop";
export { ShellStoreProvider, useShellStore } from "./desktop-store";
export { ShellDesktopIcons, type ShellIconModel } from "./desktop-icons";
export { ManagedWindow, type ManagedWindowProps } from "./managed-window";
export { PaintDesktop } from "./paint-desktop";
export {
  APPLE_MENU_ID,
  ShellMenuBar,
  type ShellMenuBarProps,
  type ShellMenuEntry,
  type ShellMenuModel,
} from "./shell-menu-bar";
export { ShellClock, formatClock } from "./shell-clock";
export {
  asylumMenuActions,
  paintMenuActions,
  registryMenus,
  unhandledMenuItemIds,
  type MenuAction,
  type MenuActions,
  type PaintMenuContext,
  type WardMenuContext,
} from "./app-menus";
export {
  APP_MAIN_WINDOW,
  SHELL_WINDOWS,
  SHELL_WINDOW_IDS,
  STARTUP_WINDOW_IDS,
  isNarrow,
  openWindowInput,
  shellWindow,
  type ShellWindowId,
  type ShellWindowSpec,
} from "./windows";
