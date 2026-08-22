export const CANVAS_WIDTH = 320;
export const CANVAS_HEIGHT = 180;
export const CANVAS_ROOM_ID = "matiasberrios-main-canvas";
export const MAX_AGENT_PIXELS = 256;
export const AGENT_CURSOR_SECONDS = 30;
export const ERASE_COLOR = "transparent";

export const PALETTE = [
  { color: "#FFFFFF", name: "White" },
  { color: "#DDDDDD", name: "Light grey" },
  { color: "#AAAAAA", name: "Medium grey" },
  { color: "#555555", name: "Dark grey" },
  { color: "#000000", name: "Black" },
  { color: "#FF0000", name: "Red" },
  { color: "#FF8C00", name: "Orange" },
  { color: "#0000FF", name: "Blue" },
  { color: "#FFFF00", name: "Yellow" },
  { color: "#FFD700", name: "Gold" },
  { color: "#BFFF00", name: "Lime" },
  { color: "#00A36C", name: "Green" },
  { color: "#F0F8FF", name: "Alice blue" },
  { color: "#00CED1", name: "Cyan" },
  { color: "#DEB887", name: "Burly wood" },
  { color: "#7FFFD4", name: "Aquamarine" },
  { color: "#1E3A8A", name: "Navy" },
  { color: "#8A2BE2", name: "Purple" },
  { color: "#4B0082", name: "Indigo" },
  { color: "#FF1493", name: "Hot pink" },
  { color: "#FFC0CB", name: "Pink" },
  { color: "#FF7F50", name: "Coral" },
  { color: "#8B4513", name: "Brown" },
  { color: "#F5DEB3", name: "Wheat" },
] as const;

export const PALETTE_COLORS = PALETTE.map(({ color }) => color) as [
  string,
  ...string[],
];

export type ParticipantKind = "human" | "agent";
export type Point = { x: number; y: number };
export type CanvasColor =
  | (typeof PALETTE)[number]["color"]
  | typeof ERASE_COLOR;

export type ParticipantPresence = {
  cursor: Point | null;
  name: string;
  color: string;
  kind: ParticipantKind;
  status: string | null;
};

export type ParticipantIdentity = Pick<
  ParticipantPresence,
  "name" | "color" | "kind"
> & {
  id: string;
};

export type VisibleParticipant = ParticipantPresence & {
  id: string;
};

export type StoredParticipant = VisibleParticipant & {
  expiresAt: string;
};

export type CanvasSnapshot = {
  pixels: Record<string, string>;
  participants: StoredParticipant[];
  revision: number;
};

export type PixelChange = {
  x: number;
  y: number;
  color: CanvasColor;
};

export type PixelTuple = readonly [
  x: number,
  y: number,
  color: CanvasColor,
];

export function pixelKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function parsePixelKey(key: string): Point | null {
  const [rawX, rawY, extra] = key.split(":");
  const x = Number(rawX);
  const y = Number(rawY);

  if (
    extra !== undefined ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= CANVAS_WIDTH ||
    y >= CANVAS_HEIGHT
  ) {
    return null;
  }

  return { x, y };
}

export function pointFromViewport(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): Point {
  return {
    x: Math.min(
      CANVAS_WIDTH - 1,
      Math.max(0, Math.floor((clientX / width) * CANVAS_WIDTH)),
    ),
    y: Math.min(
      CANVAS_HEIGHT - 1,
      Math.max(0, Math.floor((clientY / height) * CANVAS_HEIGHT)),
    ),
  };
}

export type CanvasRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * The canvas keeps its 320:180 aspect and letterboxes, so pointer coordinates map
 * against the element's own box. When the viewport already matches that aspect the
 * box fills it and this agrees with pointFromViewport exactly.
 */
export function pointFromRect(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
): Point {
  return pointFromViewport(
    clientX - rect.left,
    clientY - rect.top,
    rect.width,
    rect.height,
  );
}

export function pointsOnLine(start: Point, end: Point): Point[] {
  const points: Point[] = [];
  let x = start.x;
  let y = start.y;
  const deltaX = Math.abs(end.x - start.x);
  const deltaY = Math.abs(end.y - start.y);
  const stepX = start.x < end.x ? 1 : -1;
  const stepY = start.y < end.y ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    points.push({ x, y });
    if (x === end.x && y === end.y) return points;

    const doubledError = error * 2;
    if (doubledError > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubledError < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

export function participantColor(value: string) {
  const colors = [
    "#e63946",
    "#0066ff",
    "#00875a",
    "#8a2be2",
    "#d97706",
    "#d81b60",
  ];
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return colors[hash % colors.length];
}

export function deduplicatePixels(changes: PixelChange[]) {
  const pixels = new Map<string, PixelChange>();

  for (const change of changes) {
    pixels.set(pixelKey(change.x, change.y), change);
  }

  return [...pixels.values()];
}
