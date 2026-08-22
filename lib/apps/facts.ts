import { ASYLUM_APP, PAINT_APP, SITE } from "@/lib/apps/manifest";
import { ASYLUM_WARD_NAME, CAST } from "@/lib/asylum/cast";
import { TORMENTS } from "@/lib/asylum/torments";
import type { VisitorToolName } from "@/lib/asylum/tools";
import {
  AGENT_CURSOR_SECONDS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ERASE_COLOR,
  MAX_AGENT_PIXELS,
  PALETTE,
  PALETTE_COLORS,
} from "@/lib/canvas";

export const CANVAS_FACTS = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  minX: 0,
  minY: 0,
  maxX: CANVAS_WIDTH - 1,
  maxY: CANVAS_HEIGHT - 1,
  maxPixelsPerCall: MAX_AGENT_PIXELS,
  paletteSize: PALETTE.length,
  palette: PALETTE_COLORS,
  eraseColor: ERASE_COLOR,
  cursorSeconds: AGENT_CURSOR_SECONDS,
} as const;

export const ASYLUM_FACTS = {
  ward: ASYLUM_WARD_NAME,
  inmates: CAST.length,
  torments: TORMENTS.length,
} as const;

export const CANVAS_TOOL_NAMES: readonly string[] = PAINT_APP.agent.tools.map(
  (tool) => tool.name,
);

export const ASYLUM_TOOL_NAMES: readonly VisitorToolName[] =
  ASYLUM_APP.agent.tools.map((tool) => tool.name);

export const FACT_TOKENS: Readonly<Record<string, string>> = {
  owner: SITE.owner,
  site: SITE.name,
  transport: SITE.transport,
  width: String(CANVAS_FACTS.width),
  height: String(CANVAS_FACTS.height),
  minX: String(CANVAS_FACTS.minX),
  minY: String(CANVAS_FACTS.minY),
  maxX: String(CANVAS_FACTS.maxX),
  maxY: String(CANVAS_FACTS.maxY),
  maxPixels: String(CANVAS_FACTS.maxPixelsPerCall),
  paletteSize: String(CANVAS_FACTS.paletteSize),
  palette: CANVAS_FACTS.palette.join(", "),
  eraseColor: CANVAS_FACTS.eraseColor,
  cursorSeconds: String(CANVAS_FACTS.cursorSeconds),
  canvasTools: CANVAS_TOOL_NAMES.join(", "),
  ward: ASYLUM_FACTS.ward,
  inmates: String(ASYLUM_FACTS.inmates),
  torments: String(ASYLUM_FACTS.torments),
  asylumTools: ASYLUM_TOOL_NAMES.join(", "),
};

const TOKEN = /\{(\w+)\}/g;

export function resolveCopy(template: string) {
  return template.replace(TOKEN, (match, name: string) => {
    const value = FACT_TOKENS[name];
    if (value === undefined) throw new Error(`Unknown discovery fact ${match}`);
    return value;
  });
}
