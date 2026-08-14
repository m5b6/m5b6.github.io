export const CANVAS_WIDTH = 100;
export const CANVAS_HEIGHT = 64;
export const CANVAS_ROOM_ID = "matiasberrios-main-canvas";
export const MAX_AGENT_PIXELS = 256;

export const PALETTE = [
  { color: "#FFFFFF", name: "White" },
  { color: "#DDDDDD", name: "Light grey" },
  { color: "#AAAAAA", name: "Medium grey" },
  { color: "#000000", name: "Black" },
  { color: "#FF0000", name: "Red" },
  { color: "#0000FF", name: "Blue" },
  { color: "#FFFF00", name: "Yellow" },
  { color: "#FFD700", name: "Gold" },
  { color: "#F0F8FF", name: "Alice blue" },
  { color: "#DEB887", name: "Burly wood" },
  { color: "#7FFFD4", name: "Aquamarine" },
] as const;

export const PALETTE_COLORS = PALETTE.map(({ color }) => color) as [
  string,
  ...string[],
];

export type ParticipantKind = "human" | "agent";
export type Point = { x: number; y: number };
export type CanvasColor = (typeof PALETTE)[number]["color"] | "transparent";

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
