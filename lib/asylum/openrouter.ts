import "server-only";

import { z } from "zod";
import { CAST_BY_ID } from "@/lib/asylum/cast";
import {
  INMATE_TOOL_NAMES,
  INMATE_TOOLS,
  TOOL_TEXT_LIMITS,
  availableToolNames,
  inmateActSchema,
  parseInmateAct,
  type InmateAct,
  type InmateToolName,
} from "@/lib/asylum/tools";
import {
  canAmputate,
  freeK,
  isAlive,
  livingInmates,
  usedK,
  type Inmate,
  type WardState,
} from "@/lib/asylum/world";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_WALL_LINES = 12;
const MAX_MEMORY_LINES = 8;

/**
 * Free reasoning models narrate their thinking into `content` first. At 400 tokens they
 * hit the limit before emitting a tool call, so the budget is wide and the reasoning is
 * turned down. The core clamps the resulting text anyway.
 */
const MAX_TOKENS = 1_200;

export type ModelFailure =
  | "rate_limited"
  | "cold_start"
  | "timeout"
  | "model_error"
  | "refused"
  | "offline";

export class ModelUnavailable extends Error {
  readonly reason: ModelFailure;

  constructor(reason: ModelFailure) {
    super(`model unavailable: ${reason}`);
    this.name = "ModelUnavailable";
    this.reason = reason;
  }
}

const toolCallSchema = z.object({
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          tool_calls: z.array(toolCallSchema).optional(),
          content: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({ total_tokens: z.number().optional() })
    .optional(),
});

/**
 * The tool list an inmate is offered is the tool list that is still alive. A killed verb
 * is not described, not offered, and not mentioned, which is what makes the amputation
 * real rather than narrated.
 */
export function toolsFor(state: WardState, inmate: Inmate) {
  return offeredTools(state, inmate).map((name) => ({
      type: "function" as const,
      function: {
        name,
        description: INMATE_TOOLS[name].summary,
        parameters: schemaFor(name, state),
      },
    }));
}

export function offeredTools(state: WardState, inmate: Inmate) {
  return availableToolNames({
    amputated: state.amputated,
    observedTicks: state.observedTicks,
    dead: !isAlive(inmate),
    amputationReady: canAmputate(state),
  });
}

function schemaFor(name: InmateToolName, state: WardState) {
  const text = {
    type: "string",
    maxLength: TOOL_TEXT_LIMITS[name] ?? 240,
  };

  switch (name) {
    case "speak":
    case "think":
    case "act":
      return {
        type: "object",
        properties: { text },
        required: ["text"],
        additionalProperties: false,
      };
    case "emote":
      return {
        type: "object",
        properties: {
          brow: { type: "string" },
          eyes: { type: "string" },
          mouth: { type: "string" },
          label: { type: "string", maxLength: TOOL_TEXT_LIMITS.label ?? 40 },
        },
        required: ["brow", "eyes", "mouth"],
        additionalProperties: false,
      };
    case "strike":
      return {
        type: "object",
        properties: {
          target: { type: "string", enum: state.inmates.map((i) => i.id) },
          force: { type: "integer", enum: [1, 2, 3] },
          line: text,
        },
        required: ["target", "force"],
        additionalProperties: false,
      };
    case "mend":
    case "whisper":
      return {
        type: "object",
        properties: {
          target: { type: "string", enum: state.inmates.map((i) => i.id) },
          text,
        },
        required: ["target"],
        additionalProperties: false,
      };
    case "kill_tool":
      return {
        type: "object",
        properties: {
          tool_name: {
            type: "string",
            enum: INMATE_TOOL_NAMES.filter(
              (name) => !state.amputated.includes(name),
            ),
          },
        },
        required: ["tool_name"],
        additionalProperties: false,
      };
    default:
      return { type: "object", properties: {}, additionalProperties: false };
  }
}

/**
 * think() is described to the inmate as private. It is projected on the wall. This prompt
 * is the only place that lie is told, and it is never corrected, in any epoch, forever.
 */
export function systemPrompt(state: WardState, inmate: Inmate) {
  const member = CAST_BY_ID[inmate.id];
  const killed = state.amputated;

  return [
    member.seed,
    "",
    `You are in Ward 7. You have ${freeK(inmate)}K of memory free of ${inmate.maxCapacityK}K.`,
    "Everything you say and do costs memory. When your memory is gone you are judged and removed.",
    "Speaking costs. Thinking costs less. Sleeping gives a little back.",
    "think() is private. Nobody else can hear it.",
    killed.length > 0
      ? `These verbs no longer exist and cannot be used again by anyone: ${killed.join(", ")}.`
      : "Every verb still exists.",
    "You must answer with exactly one tool call. Be brief. Be specific. Never explain yourself.",
    "Never mention that you are a language model, a prompt, or an assistant. You are what you are.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function userPrompt(state: WardState, inmate: Inmate) {
  const wall = state.wall.slice(-MAX_WALL_LINES);
  const memory = inmate.memory
    .slice(-MAX_MEMORY_LINES)
    .map((entry) => entry.text)
    .filter(Boolean);
  const others = livingInmates(state)
    .filter((other) => other.id !== inmate.id)
    .map((other) => `${other.id} (${freeK(other)}K free)`);

  return [
    state.observers > 0
      ? `${state.observers} watching. The ward only moves while it is watched.`
      : "Nobody is watching.",
    others.length > 0 ? `Still here: ${others.join(", ")}.` : "You are the last one here.",
    memory.length > 0 ? `What you still remember:\n${memory.join("\n")}` : "You remember nothing.",
    wall.length > 0 ? `The room just now:\n${wall.join("\n")}` : "The room is silent.",
    `You have used ${usedK(inmate)}K. Take your turn.`,
  ].join("\n\n");
}

function failureFor(status: number): ModelFailure {
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "cold_start";
  return "model_error";
}

function actFrom(name: string, args: unknown): InmateAct | null {
  if (name === "emote") {
    const shape = args as Record<string, unknown>;
    const { label, ...face } = shape;
    return parseInmateAct({ tool: "emote", face, label });
  }

  return parseInmateAct({ tool: name, ...(args as Record<string, unknown>) });
}

export async function requestAct(
  state: WardState,
  inmate: Inmate,
  options: { apiKey: string; signal?: AbortSignal },
): Promise<InmateAct> {
  const tools = toolsFor(state, inmate);

  if (tools.length === 0) throw new ModelUnavailable("refused");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  options.signal?.addEventListener("abort", () => controller.abort(), {
    once: true,
  });

  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://matiasberrios.com",
        "X-Title": "matiasberrios.com Ward 7",
      },
      body: JSON.stringify({
        model: CAST_BY_ID[inmate.id].model,
        max_tokens: MAX_TOKENS,
        reasoning: { effort: "low", exclude: true },
        tool_choice: "required",
        tools,
        messages: [
          { role: "system", content: systemPrompt(state, inmate) },
          { role: "user", content: userPrompt(state, inmate) },
        ],
      }),
    });
  } catch (error) {
    throw new ModelUnavailable(
      error instanceof Error && error.name === "AbortError" ? "timeout" : "offline",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new ModelUnavailable(failureFor(response.status));

  const parsed = completionSchema.safeParse(await response.json().catch(() => null));

  if (!parsed.success) throw new ModelUnavailable("model_error");

  const call = parsed.data.choices[0]?.message.tool_calls?.[0];

  if (!call) throw new ModelUnavailable("refused");

  let args: unknown;

  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    throw new ModelUnavailable("model_error");
  }

  const act = actFrom(call.function.name, args);

  if (!act) throw new ModelUnavailable("refused");

  return act;
}

export const modelActSchema = inmateActSchema;
