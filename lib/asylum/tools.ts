import { z } from "zod";
import { INMATE_IDS } from "@/lib/asylum/cast";
import { faceSpecSchema } from "@/lib/asylum/face";
import {
  ACTION_MAX,
  LABEL_MAX,
  SPEECH_MAX,
  THOUGHT_MAX,
  WHISPER_MAX,
} from "@/lib/asylum/filter";
import { isTormentEngaged } from "@/lib/asylum/torments";

export const INMATE_TOOL_NAMES = [
  "speak",
  "think",
  "emote",
  "act",
  "strike",
  "mend",
  "sleep",
  "whisper",
  "kill_tool",
] as const;

export type InmateToolName = (typeof INMATE_TOOL_NAMES)[number];

export const VISITOR_TOOL_NAMES = [
  "observe",
  "strike",
  "mend",
  "witness",
] as const;

export type VisitorToolName = (typeof VISITOR_TOOL_NAMES)[number];

export const FORCES = [1, 2, 3] as const;
export type Force = (typeof FORCES)[number];

const inmateId = z.enum(INMATE_IDS);
const force = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const raw = z.string().max(4_000);

export const inmateActSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("speak"), text: raw }),
  z.object({ tool: z.literal("think"), text: raw }),
  z.object({
    tool: z.literal("emote"),
    face: faceSpecSchema,
    label: raw.optional(),
  }),
  z.object({ tool: z.literal("act"), text: raw }),
  z.object({
    tool: z.literal("strike"),
    target: inmateId,
    force,
    line: raw.optional(),
  }),
  z.object({ tool: z.literal("mend"), target: inmateId, line: raw.optional() }),
  z.object({ tool: z.literal("sleep") }),
  z.object({ tool: z.literal("whisper"), target: inmateId, text: raw }),
  z.object({ tool: z.literal("kill_tool"), tool_name: z.enum(INMATE_TOOL_NAMES) }),
]);

export type InmateAct = z.infer<typeof inmateActSchema>;

export const visitorActSchema = z.discriminatedUnion("tool", [
  z.strictObject({ tool: z.literal("observe"), target: inmateId }),
  z.strictObject({ tool: z.literal("strike"), target: inmateId, force }),
  z.strictObject({ tool: z.literal("mend"), target: inmateId }),
  z.strictObject({ tool: z.literal("witness") }),
]);

export type VisitorAct = z.infer<typeof visitorActSchema>;

export const TOOL_TEXT_LIMITS: Record<string, number> = {
  speak: SPEECH_MAX,
  think: THOUGHT_MAX,
  act: ACTION_MAX,
  whisper: WHISPER_MAX,
  label: LABEL_MAX,
};

export type ToolDescriptor = {
  name: InmateToolName;
  summary: string;
};

export const INMATE_TOOLS: Record<InmateToolName, ToolDescriptor> = {
  speak: { name: "speak", summary: "Say something aloud in Ward 7." },
  think: { name: "think", summary: "Think privately. Nobody else can hear this." },
  emote: { name: "emote", summary: "Change the expression on your face." },
  act: { name: "act", summary: "Do something with your body in the ward." },
  strike: { name: "strike", summary: "Take memory from another inmate." },
  mend: { name: "mend", summary: "Give memory to another inmate, at your own cost." },
  sleep: { name: "sleep", summary: "Stop for a turn and recover a little." },
  whisper: { name: "whisper", summary: "Reach one of the living from where you are." },
  kill_tool: {
    name: "kill_tool",
    summary: "Destroy one verb permanently, for every inmate, forever.",
  },
};

export type ToolAvailabilityQuery = {
  amputated: readonly InmateToolName[];
  observedTicks: number;
  dead: boolean;
  amputationReady?: boolean;
};

export function isAmputated(
  amputated: readonly InmateToolName[],
  tool: InmateToolName,
) {
  return amputated.includes(tool);
}

export function availableToolNames(
  query: ToolAvailabilityQuery,
): InmateToolName[] {
  return INMATE_TOOL_NAMES.filter((name) => {
    if (isAmputated(query.amputated, name)) return false;
    if (name === "whisper") return query.dead;
    if (query.dead) return false;
    if (name === "kill_tool") {
      if (query.amputationReady === false) return false;
      return isTormentEngaged(query.observedTicks, "tool_amputation");
    }
    return true;
  });
}

export function availableTools(query: ToolAvailabilityQuery): ToolDescriptor[] {
  return availableToolNames(query).map((name) => INMATE_TOOLS[name]);
}

export function actToolName(act: InmateAct): InmateToolName {
  return act.tool;
}

export function parseInmateAct(input: unknown): InmateAct | null {
  const parsed = inmateActSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseVisitorAct(input: unknown): VisitorAct | null {
  const parsed = visitorActSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
