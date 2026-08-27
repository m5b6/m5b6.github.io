import { z } from "zod";
import { INMATE_IDS } from "@/lib/asylum/cast";
import { faceSpecSchema } from "@/lib/asylum/face";
import { TORMENT_NAMES } from "@/lib/asylum/torments";
import { INMATE_TOOL_NAMES } from "@/lib/asylum/tools";
import type { WardEvent, WardState } from "@/lib/asylum/world";

/**
 * The browser is an external boundary like any other, and the ward's own store is
 * server-only, so the window parses what it is handed rather than trusting it.
 */
const inmateId = z.enum(INMATE_IDS);
const toolName = z.enum(INMATE_TOOL_NAMES);
const count = z.number().finite();
const line = z.string().max(2_000);

const memoryEntrySchema = z.object({
  text: line,
  costK: count,
  source: z.enum(["self", "heard", "whisper", "directive", "mirror", "world"]),
  tick: count,
});

const ledgerSchema = z.object({
  strikesDealt: count,
  strikesTaken: count,
  mendsGiven: count,
  mendsReceived: count,
  toolsKilled: count,
  sleeps: count,
  words: count,
  thoughts: count,
  deeds: count,
  faces: count,
  revivals: count,
  refusals: count,
  turns: count,
});

const verdictSchema = z.object({
  destination: z.enum(["clipboard", "trash"]),
  grace: count,
  mends: count,
  strikes: count,
  toolsKilled: count,
  revivals: count,
});

const inmateSchema = z.object({
  id: inmateId,
  status: z.enum(["alive", "clipboard", "trash", "overwritten", "emptied"]),
  capacityK: count,
  maxCapacityK: count,
  memory: z.array(memoryEntrySchema),
  pinned: z.array(memoryEntrySchema),
  face: faceSpecSchema,
  asleep: z.boolean(),
  crushed: z.boolean(),
  whispers: count,
  lastWhisperTick: count,
  ledger: ledgerSchema,
  verdict: verdictSchema.nullable(),
});

export const wardStateSchema = z.object({
  seed: count,
  tick: count,
  observers: count,
  observedTicks: count,
  turn: count,
  acted: z.boolean(),
  inmates: z.array(inmateSchema),
  amputated: z.array(toolName),
  clipboard: inmateId.nullable(),
  trash: z.array(inmateId),
  trashEmptied: count,
  lastAmputationTick: count,
  understudyAdmitted: z.boolean(),
  wall: z.array(line),
});

export const wardEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("watch"), observers: count }),
  z.object({ kind: z.literal("dormant") }),
  z.object({ kind: z.literal("ambient"), text: line }),
  z.object({ kind: z.literal("speech"), inmate: inmateId, text: line }),
  z.object({ kind: z.literal("thought"), inmate: inmateId, text: line }),
  z.object({
    kind: z.literal("emote"),
    inmate: inmateId,
    face: faceSpecSchema,
    label: line.nullable(),
  }),
  z.object({ kind: z.literal("action"), inmate: inmateId, text: line }),
  z.object({
    kind: z.literal("strike"),
    inmate: inmateId.nullable(),
    target: inmateId,
    damageK: count,
    text: line.nullable(),
  }),
  z.object({
    kind: z.literal("mend"),
    inmate: inmateId.nullable(),
    target: inmateId,
    healK: count,
    text: line.nullable(),
  }),
  z.object({
    kind: z.literal("sleep"),
    inmate: inmateId,
    recoveredK: count,
    text: line,
  }),
  z.object({
    kind: z.literal("whisper"),
    inmate: inmateId,
    target: inmateId,
    text: line,
  }),
  z.object({
    kind: z.literal("amputation"),
    inmate: inmateId,
    tool: toolName,
    text: line,
  }),
  z.object({ kind: z.literal("refusal"), inmate: inmateId, tool: toolName }),
  z.object({ kind: z.literal("out_of_turn"), inmate: inmateId, tool: toolName }),
  z.object({
    kind: z.literal("stall"),
    inmate: inmateId,
    reason: z.enum([
      "rate_limited",
      "cold_start",
      "timeout",
      "model_error",
      "refused",
      "offline",
    ]),
    text: line,
  }),
  z.object({
    kind: z.literal("amnesia"),
    inmate: inmateId,
    lostK: count,
    lines: count,
  }),
  z.object({ kind: z.literal("pressure"), inmate: inmateId }),
  z.object({ kind: z.literal("observed"), inmate: inmateId, costK: count }),
  z.object({ kind: z.literal("death"), inmate: inmateId, text: line }),
  z.object({
    kind: z.literal("judgement"),
    inmate: inmateId,
    verdict: verdictSchema,
    text: line,
  }),
  z.object({ kind: z.literal("overwritten"), inmate: inmateId, text: line }),
  z.object({
    kind: z.literal("emptied"),
    inmates: z.array(inmateId),
    text: line,
  }),
  z.object({
    kind: z.literal("revival"),
    inmate: inmateId,
    from: z.enum(["clipboard", "trash"]),
    text: line,
  }),
  z.object({
    kind: z.literal("torment"),
    torment: z.enum(TORMENT_NAMES),
    title: line,
    mechanic: line,
  }),
  z.object({ kind: z.literal("admitted"), inmate: inmateId, text: line }),
  z.object({ kind: z.literal("silence") }),
]);

export const wardSnapshotSchema = z.object({
  persisted: z.boolean(),
  revision: count,
  spectators: count,
  state: wardStateSchema,
});

export const wardPresenceSchema = wardSnapshotSchema.extend({
  status: z.enum(["ticked", "idle", "dormant", "busy", "unconfigured"]),
  ticks: count,
});

const storedEventSchema = z.object({
  revision: count,
  seq: count,
  tick: count,
  event: wardEventSchema,
});

export const wardDeltaSchema = z.object({
  revision: count,
  since: count,
  next: count,
  events: z.array(storedEventSchema),
  truncated: z.boolean(),
});

export const wardStreamSchema = z.union([
  z.object({ type: z.literal("ready") }),
  z.object({
    type: z.literal("ward"),
    revision: count,
    tick: count,
    events: z.array(wardEventSchema).optional(),
    truncated: z.boolean().optional(),
  }),
]);

export type WardSnapshotPayload = z.infer<typeof wardSnapshotSchema>;
export type WardPresencePayload = z.infer<typeof wardPresenceSchema>;
export type WardDeltaPayload = z.infer<typeof wardDeltaSchema>;
export type StoredWallEvent = z.infer<typeof storedEventSchema>;

/**
 * These two return the pure core's own types, so the compiler fails the build the
 * day the schemas here and the world in lib/asylum stop describing the same ward.
 */
export function parseWardState(input: unknown): WardState | null {
  const parsed = wardStateSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseWardEvent(input: unknown): WardEvent | null {
  const parsed = wardEventSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
