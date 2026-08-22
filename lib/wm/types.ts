export type WindowId = string;
export type AppId = string;

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;
export type Viewport = Size;

export type SizeConstraint = { minWidth: number; minHeight: number };

export type WindowState = {
  id: WindowId;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  collapsed: boolean;
  focused: boolean;
};

export type DesktopState = {
  windows: Readonly<Record<WindowId, WindowState>>;
  order: readonly WindowId[];
  focusedId: WindowId | null;
  viewport: Viewport;
  cascadeIndex: number;
};

export type OpenWindowInput = {
  id: WindowId;
  appId: AppId;
  title: string;
  position?: Point;
  size?: Partial<Size>;
  minSize?: Partial<Size>;
  collapsed?: boolean;
};

export type DesktopAction =
  | { type: "open"; window: OpenWindowInput }
  | { type: "close"; id: WindowId }
  | { type: "focus"; id: WindowId }
  | { type: "bringToFront"; id: WindowId }
  | { type: "move"; id: WindowId; position: Point }
  | { type: "resize"; id: WindowId; size: Size; position?: Point }
  | { type: "collapse"; id: WindowId; collapsed?: boolean }
  | { type: "viewport"; viewport: Viewport };
