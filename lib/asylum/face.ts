import { z } from "zod";

export const FACE_VIEWBOX = 64;
export const MAX_CUSTOM_NODES = 12;
export const MAX_RENDER_NODES = 72;
export const MAX_PATH_TOKENS = 16;
export const MAX_POLYLINE_POINTS = 12;
export const MAX_MARKS = 3;

export const BROWS = [
  "flat",
  "raised",
  "furrowed",
  "one_up",
  "gone",
] as const;

export const EYES = [
  "open",
  "wide",
  "shut",
  "squint",
  "crossed",
  "pinhole",
  "asymmetric",
  "empty",
  "gone",
] as const;

export const MOUTHS = [
  "line",
  "open",
  "grin",
  "grimace",
  "small_o",
  "wave",
  "stitched",
  "none",
] as const;

export const MARKS = [
  "tear",
  "sweat",
  "crack",
  "static",
  "halo",
  "dither",
  "dot_left",
  "dot_right",
] as const;

export const PAINTS = ["none", "#000", "#fff"] as const;
export const STROKE_WIDTHS = [1, 2] as const;
export const ELEMENTS = ["line", "circle", "rect", "polyline", "path"] as const;
export const PATH_COMMANDS = ["M", "L", "Q"] as const;

export type Brow = (typeof BROWS)[number];
export type Eyes = (typeof EYES)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Mark = (typeof MARKS)[number];
export type Paint = (typeof PAINTS)[number];
export type StrokeWidth = (typeof STROKE_WIDTHS)[number];

const coord = z.number().int().min(0).max(FACE_VIEWBOX);
const radius = z.number().int().min(1).max(32);
const span = z.number().int().min(1).max(FACE_VIEWBOX);
const tiltValue = z.number().int().min(-12).max(12);
const paint = z.enum(PAINTS);
const strokeWidth = z.union([z.literal(1), z.literal(2)]);

const pathTokenSchema = z.discriminatedUnion("c", [
  z.object({ c: z.literal("M"), x: coord, y: coord }),
  z.object({ c: z.literal("L"), x: coord, y: coord }),
  z.object({ c: z.literal("Q"), cx: coord, cy: coord, x: coord, y: coord }),
]);

export const faceNodeSchema = z.discriminatedUnion("el", [
  z.object({
    el: z.literal("line"),
    x1: coord,
    y1: coord,
    x2: coord,
    y2: coord,
    sw: strokeWidth.optional(),
  }),
  z.object({
    el: z.literal("circle"),
    cx: coord,
    cy: coord,
    r: radius,
    fill: paint.optional(),
    sw: strokeWidth.optional(),
  }),
  z.object({
    el: z.literal("rect"),
    x: coord,
    y: coord,
    rw: span,
    rh: span,
    fill: paint.optional(),
    sw: strokeWidth.optional(),
  }),
  z.object({
    el: z.literal("polyline"),
    points: z
      .array(z.tuple([coord, coord]))
      .min(2)
      .max(MAX_POLYLINE_POINTS),
    fill: paint.optional(),
    sw: strokeWidth.optional(),
  }),
  z.object({
    el: z.literal("path"),
    d: z.array(pathTokenSchema).min(1).max(MAX_PATH_TOKENS),
    fill: paint.optional(),
    sw: strokeWidth.optional(),
  }),
]);

export type FaceNode = z.infer<typeof faceNodeSchema>;
export type PathToken = z.infer<typeof pathTokenSchema>;

export const faceSpecSchema = z.object({
  brow: z.enum(BROWS).catch("flat"),
  eyes: z.enum(EYES).catch("open"),
  mouth: z.enum(MOUTHS).catch("line"),
  marks: z.array(z.enum(MARKS)).max(MAX_MARKS).catch([]),
  tilt: tiltValue.catch(0),
  nodes: z.array(faceNodeSchema).max(MAX_CUSTOM_NODES).catch([]),
});

export type FaceSpec = z.infer<typeof faceSpecSchema>;

export function face(spec: Partial<FaceSpec>): FaceSpec {
  return faceSpecSchema.parse(spec);
}

export const NEUTRAL_FACE: FaceSpec = face({});
export const UNREADABLE_FACE: FaceSpec = face({
  brow: "gone",
  eyes: "empty",
  mouth: "none",
  marks: ["static"],
});
export const SLEEPING_FACE: FaceSpec = face({
  brow: "flat",
  eyes: "shut",
  mouth: "small_o",
});
export const DEAD_FACE: FaceSpec = face({
  brow: "gone",
  eyes: "crossed",
  mouth: "line",
});
export const BLESSED_FACE: FaceSpec = face({
  brow: "raised",
  eyes: "shut",
  mouth: "line",
  marks: ["halo"],
});
export const DAMNED_FACE: FaceSpec = face({
  brow: "furrowed",
  eyes: "pinhole",
  mouth: "grimace",
  marks: ["crack"],
});
export const ERASED_FACE: FaceSpec = face({
  brow: "gone",
  eyes: "gone",
  mouth: "none",
});

const CASE: readonly FaceNode[] = [
  { el: "rect", x: 6, y: 4, rw: 52, rh: 56, fill: "#fff", sw: 2 },
  { el: "rect", x: 11, y: 9, rw: 42, rh: 34, fill: "#fff", sw: 2 },
  { el: "line", x1: 22, y1: 52, x2: 42, y2: 52, sw: 2 },
];

const BROW_NODES: Record<Brow, readonly FaceNode[]> = {
  flat: [
    { el: "line", x1: 17, y1: 16, x2: 27, y2: 16, sw: 2 },
    { el: "line", x1: 37, y1: 16, x2: 47, y2: 16, sw: 2 },
  ],
  raised: [
    { el: "line", x1: 17, y1: 13, x2: 27, y2: 13, sw: 2 },
    { el: "line", x1: 37, y1: 13, x2: 47, y2: 13, sw: 2 },
  ],
  furrowed: [
    { el: "line", x1: 17, y1: 13, x2: 27, y2: 18, sw: 2 },
    { el: "line", x1: 47, y1: 13, x2: 37, y2: 18, sw: 2 },
  ],
  one_up: [
    { el: "line", x1: 17, y1: 13, x2: 27, y2: 13, sw: 2 },
    { el: "line", x1: 47, y1: 13, x2: 37, y2: 18, sw: 2 },
  ],
  gone: [],
};

const EYE_NODES: Record<Eyes, readonly FaceNode[]> = {
  open: [
    { el: "circle", cx: 23, cy: 23, r: 3, fill: "#000", sw: 1 },
    { el: "circle", cx: 41, cy: 23, r: 3, fill: "#000", sw: 1 },
  ],
  wide: [
    { el: "circle", cx: 23, cy: 23, r: 6, fill: "none", sw: 1 },
    { el: "circle", cx: 23, cy: 23, r: 2, fill: "#000", sw: 1 },
    { el: "circle", cx: 41, cy: 23, r: 6, fill: "none", sw: 1 },
    { el: "circle", cx: 41, cy: 23, r: 2, fill: "#000", sw: 1 },
  ],
  shut: [
    { el: "line", x1: 18, y1: 23, x2: 28, y2: 23, sw: 2 },
    { el: "line", x1: 36, y1: 23, x2: 46, y2: 23, sw: 2 },
  ],
  squint: [
    { el: "polyline", points: [[18, 25], [23, 21], [28, 25]], fill: "none", sw: 2 },
    { el: "polyline", points: [[36, 25], [41, 21], [46, 25]], fill: "none", sw: 2 },
  ],
  crossed: [
    { el: "line", x1: 19, y1: 19, x2: 27, y2: 27, sw: 2 },
    { el: "line", x1: 27, y1: 19, x2: 19, y2: 27, sw: 2 },
    { el: "line", x1: 37, y1: 19, x2: 45, y2: 27, sw: 2 },
    { el: "line", x1: 45, y1: 19, x2: 37, y2: 27, sw: 2 },
  ],
  pinhole: [
    { el: "circle", cx: 23, cy: 23, r: 5, fill: "none", sw: 1 },
    { el: "circle", cx: 23, cy: 23, r: 1, fill: "#000", sw: 1 },
    { el: "circle", cx: 41, cy: 23, r: 5, fill: "none", sw: 1 },
    { el: "circle", cx: 41, cy: 23, r: 1, fill: "#000", sw: 1 },
  ],
  asymmetric: [
    { el: "circle", cx: 23, cy: 23, r: 6, fill: "none", sw: 1 },
    { el: "circle", cx: 23, cy: 23, r: 2, fill: "#000", sw: 1 },
    { el: "line", x1: 36, y1: 23, x2: 46, y2: 23, sw: 2 },
  ],
  empty: [
    { el: "circle", cx: 23, cy: 23, r: 5, fill: "#fff", sw: 2 },
    { el: "circle", cx: 41, cy: 23, r: 5, fill: "#fff", sw: 2 },
  ],
  gone: [],
};

const MOUTH_NODES: Record<Mouth, readonly FaceNode[]> = {
  line: [{ el: "line", x1: 24, y1: 34, x2: 40, y2: 34, sw: 2 }],
  open: [{ el: "rect", x: 27, y: 31, rw: 10, rh: 8, fill: "#000", sw: 1 }],
  grin: [
    {
      el: "polyline",
      points: [[22, 30], [26, 37], [38, 37], [42, 30]],
      fill: "none",
      sw: 2,
    },
  ],
  grimace: [
    { el: "rect", x: 24, y: 30, rw: 16, rh: 8, fill: "none", sw: 1 },
    { el: "line", x1: 28, y1: 30, x2: 28, y2: 38, sw: 1 },
    { el: "line", x1: 32, y1: 30, x2: 32, y2: 38, sw: 1 },
    { el: "line", x1: 36, y1: 30, x2: 36, y2: 38, sw: 1 },
  ],
  small_o: [{ el: "circle", cx: 32, cy: 34, r: 3, fill: "none", sw: 2 }],
  wave: [
    {
      el: "polyline",
      points: [[22, 35], [27, 31], [32, 35], [37, 31], [42, 35]],
      fill: "none",
      sw: 2,
    },
  ],
  stitched: [
    { el: "line", x1: 22, y1: 34, x2: 42, y2: 34, sw: 2 },
    { el: "line", x1: 26, y1: 31, x2: 26, y2: 37, sw: 1 },
    { el: "line", x1: 31, y1: 31, x2: 31, y2: 37, sw: 1 },
    { el: "line", x1: 36, y1: 31, x2: 36, y2: 37, sw: 1 },
  ],
  none: [],
};

const MARK_NODES: Record<Mark, readonly FaceNode[]> = {
  tear: [
    {
      el: "polyline",
      points: [[41, 27], [44, 33], [41, 39], [38, 33], [41, 27]],
      fill: "none",
      sw: 1,
    },
  ],
  sweat: [
    { el: "line", x1: 49, y1: 10, x2: 52, y2: 15, sw: 1 },
    { el: "line", x1: 54, y1: 12, x2: 56, y2: 17, sw: 1 },
  ],
  crack: [
    {
      el: "polyline",
      points: [[13, 11], [19, 20], [14, 27], [21, 36], [16, 42]],
      fill: "none",
      sw: 1,
    },
  ],
  static: [
    { el: "line", x1: 13, y1: 17, x2: 51, y2: 17, sw: 1 },
    { el: "line", x1: 13, y1: 29, x2: 51, y2: 29, sw: 1 },
    { el: "line", x1: 13, y1: 40, x2: 51, y2: 40, sw: 1 },
  ],
  halo: [
    {
      el: "polyline",
      points: [[20, 3], [26, 0], [38, 0], [44, 3]],
      fill: "none",
      sw: 2,
    },
  ],
  dither: [
    { el: "circle", cx: 14, cy: 46, r: 1, fill: "#000", sw: 1 },
    { el: "circle", cx: 18, cy: 48, r: 1, fill: "#000", sw: 1 },
    { el: "circle", cx: 22, cy: 46, r: 1, fill: "#000", sw: 1 },
    { el: "circle", cx: 26, cy: 48, r: 1, fill: "#000", sw: 1 },
    { el: "circle", cx: 30, cy: 46, r: 1, fill: "#000", sw: 1 },
    { el: "circle", cx: 34, cy: 48, r: 1, fill: "#000", sw: 1 },
  ],
  dot_left: [{ el: "circle", cx: 16, cy: 40, r: 1, fill: "#000", sw: 1 }],
  dot_right: [{ el: "circle", cx: 48, cy: 40, r: 1, fill: "#000", sw: 1 }],
};

export function parseFace(input: unknown): FaceSpec {
  try {
    const parsed = faceSpecSchema.safeParse(input);
    return parsed.success ? parsed.data : UNREADABLE_FACE;
  } catch {
    return UNREADABLE_FACE;
  }
}

function lookup<T>(table: Record<string, readonly T[]>, key: string) {
  return Object.hasOwn(table, key) ? table[key] : [];
}

export function faceNodes(spec: FaceSpec): FaceNode[] {
  const marks = spec.marks.slice(0, MAX_MARKS).flatMap((mark) => MARK_NODES[mark] ?? []);
  return [
    ...CASE,
    ...lookup(BROW_NODES, spec.brow),
    ...lookup(EYE_NODES, spec.eyes),
    ...lookup(MOUTH_NODES, spec.mouth),
    ...marks,
    ...spec.nodes.slice(0, MAX_CUSTOM_NODES),
  ].slice(0, MAX_RENDER_NODES);
}

export function faceTilt(spec: FaceSpec) {
  const value = Math.trunc(spec.tilt);
  if (!Number.isFinite(value)) return 0;
  return Math.min(12, Math.max(-12, value));
}

function unsigned(value: number) {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return "0";
  return String(Math.min(FACE_VIEWBOX, Math.max(0, rounded)));
}

function extent(value: number) {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return "1";
  return String(Math.min(FACE_VIEWBOX, Math.max(1, rounded)));
}

function paintValue(value: Paint | undefined, fallback: Paint): Paint {
  return value !== undefined && PAINTS.includes(value) ? value : fallback;
}

function widthValue(value: StrokeWidth | undefined): "1" | "2" {
  return value === 1 ? "1" : "2";
}

function serializePath(tokens: readonly PathToken[]) {
  return tokens
    .slice(0, MAX_PATH_TOKENS)
    .map((token, index) => {
      if (index === 0) return `M ${unsigned(tokenX(token))} ${unsigned(tokenY(token))}`;
      if (token.c === "Q") {
        return `Q ${unsigned(token.cx)} ${unsigned(token.cy)} ${unsigned(token.x)} ${unsigned(token.y)}`;
      }
      return `${token.c === "M" ? "M" : "L"} ${unsigned(token.x)} ${unsigned(token.y)}`;
    })
    .join(" ");
}

function tokenX(token: PathToken) {
  return token.x;
}

function tokenY(token: PathToken) {
  return token.y;
}

function serializeNode(node: FaceNode): string {
  switch (node.el) {
    case "line":
      return `<line x1="${unsigned(node.x1)}" y1="${unsigned(node.y1)}" x2="${unsigned(node.x2)}" y2="${unsigned(node.y2)}" stroke-width="${widthValue(node.sw)}" />`;
    case "circle":
      return `<circle cx="${unsigned(node.cx)}" cy="${unsigned(node.cy)}" r="${extent(node.r)}" fill="${paintValue(node.fill, "none")}" stroke-width="${widthValue(node.sw)}" />`;
    case "rect":
      return `<rect x="${unsigned(node.x)}" y="${unsigned(node.y)}" width="${extent(node.rw)}" height="${extent(node.rh)}" fill="${paintValue(node.fill, "none")}" stroke-width="${widthValue(node.sw)}" />`;
    case "polyline":
      return `<polyline points="${node.points
        .slice(0, MAX_POLYLINE_POINTS)
        .map(([x, y]) => `${unsigned(x)},${unsigned(y)}`)
        .join(" ")}" fill="${paintValue(node.fill, "none")}" stroke-width="${widthValue(node.sw)}" />`;
    case "path":
      return `<path d="${serializePath(node.d)}" fill="${paintValue(node.fill, "none")}" stroke-width="${widthValue(node.sw)}" />`;
  }
}

export function serializeFaceSvg(spec: FaceSpec) {
  const tilt = faceTilt(spec);
  const body = faceNodes(spec).map(serializeNode).join("");
  const open = tilt === 0 ? "" : `<g transform="rotate(${tilt} 32 32)">`;
  const close = tilt === 0 ? "" : "</g>";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FACE_VIEWBOX} ${FACE_VIEWBOX}" width="${FACE_VIEWBOX}" height="${FACE_VIEWBOX}" shape-rendering="crispEdges" stroke="#000" stroke-linecap="square" stroke-linejoin="miter" fill="none">${open}${body}${close}</svg>`;
}

export function renderFace(input: unknown) {
  return serializeFaceSvg(parseFace(input));
}
