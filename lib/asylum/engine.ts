import "server-only";

import { z } from "zod";
import { dreamAct, dreamRun, dreamWhisper } from "@/lib/asylum/dream";
import {
  consumeWardLimit,
  isAsylumConfigured,
  readWard,
  readWardDelta,
  touchSpectator,
  withWardLock,
  type SpectatorKind,
  type WardDelta,
  type WardSession,
  type WardSnapshot,
} from "@/lib/asylum/store";
import { visitorActSchema, type InmateAct, type VisitorAct } from "@/lib/asylum/tools";
import {
  absorbFailure,
  advance,
  currentInmate,
  type FailureKind,
  type Inmate,
  type WardEvent,
  type WardResult,
  type WardState,
} from "@/lib/asylum/world";

export const WARD_TICK_MS = 5_000;
export const MAX_CATCHUP_TICKS = 12;
export const DORMANT_AFTER_MS = 120_000;
export const SPECTATOR_TTL_SECONDS = 20;
export const PREVIEW_MAX_TICKS = 200;

/**
 * Every argument a visitor may send is an enum or a small integer. D1: no byte
 * of a request body can reach a model prompt, because no request body carries
 * a byte a model would ever read.
 */
export const spectatorSchema = z.strictObject({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9:_-]+$/),
  kind: z.enum(["human", "agent"]),
});

export const presenceRequestSchema = z.strictObject({
  spectator: spectatorSchema,
});

export const visitRequestSchema = z.strictObject({
  spectator: spectatorSchema,
  act: visitorActSchema,
});

export const sinceSchema = z.object({
  since: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
});

export type Spectator = z.infer<typeof spectatorSchema>;

type MaybePromise<T> = T | Promise<T>;

export type WardIntent = {
  readonly source: "dream" | "model";
  act(state: WardState, inmate: Inmate): MaybePromise<InmateAct | null>;
  whisper(
    state: WardState,
  ): MaybePromise<{ speaker: Inmate; act: InmateAct } | null>;
};

/** A provider raises this to name the narrative its failure becomes. */
export class WardStall extends Error {
  readonly reason: FailureKind;

  constructor(reason: FailureKind) {
    super(`ward stall: ${reason}`);
    this.name = "WardStall";
    this.reason = reason;
  }
}

export const dreamIntent: WardIntent = {
  source: "dream",
  act: (state, inmate) => dreamAct(state, inmate),
  whisper: (state) => dreamWhisper(state),
};

export function liveModelsEnabled(
  env: { readonly [key: string]: string | undefined } = process.env,
) {
  return env.VERCEL_ENV === "production" && Boolean(env.OPENROUTER_API_KEY);
}

/**
 * D9: the live provider is not written. Even where a key exists the ward
 * dreams, so the intent source is a seam and never a dependency.
 */
export function resolveWardIntent(
  _env: { readonly [key: string]: string | undefined } = process.env,
): WardIntent {
  return dreamIntent;
}

export function dueTicks(
  elapsedMs: number,
  options: { intervalMs?: number; maxTicks?: number; dormantAfterMs?: number } = {},
) {
  const interval = Math.max(1, options.intervalMs ?? WARD_TICK_MS);
  const cap = Math.max(0, options.maxTicks ?? MAX_CATCHUP_TICKS);
  const dormantAfter = options.dormantAfterMs ?? DORMANT_AFTER_MS;

  if (!Number.isFinite(elapsedMs)) return Math.min(1, cap);
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= dormantAfter) return Math.min(1, cap);
  return Math.min(cap, Math.floor(elapsedMs / interval));
}

function stallReason(error: unknown): FailureKind {
  return error instanceof WardStall ? error.reason : "model_error";
}

/**
 * The thesis in one function: with nobody watching this loop does nothing at
 * all, so there is nothing to write down.
 */
export async function runWardTicks(
  state: WardState,
  options: { ticks: number; observers: number; intent?: WardIntent },
): Promise<WardResult> {
  const intent = options.intent ?? dreamIntent;
  const observers = Math.max(0, Math.trunc(options.observers));
  const ticks = Math.max(0, Math.trunc(options.ticks));
  const events: WardEvent[] = [];
  let current = state;

  const step = (result: WardResult) => {
    current = result.state;
    events.push(...result.events);
  };

  if (current.observers !== observers) {
    step(advance(current, { type: "watch", observers }));
  }

  for (let index = 0; index < ticks; index += 1) {
    if (current.observers <= 0) break;

    try {
      const whisper = await intent.whisper(current);
      if (whisper) {
        step(
          advance(current, {
            type: "act",
            inmateId: whisper.speaker.id,
            act: whisper.act,
          }),
        );
      }
    } catch {
      // A voice from the Trash that does not arrive is simply not heard.
    }

    const actor = currentInmate(current);
    if (actor) {
      try {
        const act = await intent.act(current, actor);
        if (act) step(advance(current, { type: "act", inmateId: actor.id, act }));
      } catch (error) {
        step(advance(current, absorbFailure(stallReason(error), actor.id)));
      }
    }

    step(advance(current, { type: "tick" }));
  }

  return { state: current, events };
}

export type WardStatus = "ticked" | "idle" | "dormant" | "busy" | "unconfigured";

export type WardOutcome = {
  status: WardStatus;
  persisted: boolean;
  revision: number;
  ticks: number;
  spectators: number;
  state: WardState;
  events: WardEvent[];
};

let previewCache: { ticks: number; state: WardState } | null = null;

/**
 * No DATABASE_URL is not an error, it is a ward nobody can save. The dream
 * still runs, keyed to the clock, so a first-run local desktop is alive.
 */
export function previewWard(now = Date.now()): WardOutcome {
  const ticks = Math.min(
    PREVIEW_MAX_TICKS,
    Math.floor((now % (PREVIEW_MAX_TICKS * WARD_TICK_MS)) / WARD_TICK_MS),
  );

  if (previewCache?.ticks !== ticks) {
    previewCache = { ticks, state: dreamRun({ seed: 7, ticks, observers: 1 }).state };
  }

  return {
    status: "unconfigured",
    persisted: false,
    revision: 0,
    ticks: 0,
    spectators: 0,
    state: previewCache.state,
    events: [],
  };
}

function outcome(
  status: WardStatus,
  snapshot: WardSnapshot,
  extra: { ticks?: number; events?: WardEvent[] } = {},
): WardOutcome {
  return {
    status,
    persisted: true,
    revision: snapshot.revision,
    ticks: extra.ticks ?? 0,
    spectators: snapshot.spectators,
    state: snapshot.state,
    events: extra.events ?? [],
  };
}

export async function wardSnapshot(): Promise<WardOutcome> {
  if (!isAsylumConfigured()) return previewWard();
  return outcome("idle", await readWard());
}

export async function wardDelta(since: number): Promise<WardDelta> {
  if (!isAsylumConfigured()) {
    return { revision: 0, since, next: 0, events: [], truncated: false };
  }

  return readWardDelta(since);
}

export type AdvanceOptions = {
  now?: number;
  catchUp?: boolean;
  intent?: WardIntent;
  visit?: VisitorAct;
};

export async function advanceWard(
  session: WardSession,
  options: AdvanceOptions = {},
): Promise<WardOutcome> {
  const now = options.now ?? Date.now();
  const spectators = await session.spectators();
  const record = await session.load();

  if (spectators <= 0) {
    return {
      status: "dormant",
      persisted: true,
      revision: record.revision,
      ticks: 0,
      spectators: 0,
      state: record.state,
      events: [],
    };
  }

  const elapsed = record.tickedAt === null ? Number.POSITIVE_INFINITY : now - record.tickedAt;
  const ticks = options.catchUp ? dueTicks(elapsed) : 0;
  const events: WardEvent[] = [];
  let state = record.state;

  if (options.visit) {
    if (state.observers !== spectators) {
      const watched = advance(state, { type: "watch", observers: spectators });
      state = watched.state;
      events.push(...watched.events);
    }

    const visited = advance(state, { type: "visit", act: options.visit });
    state = visited.state;
    events.push(...visited.events);
  }

  const run = await runWardTicks(state, {
    ticks,
    observers: spectators,
    intent: options.intent,
  });
  state = run.state;
  events.push(...run.events);

  if (events.length === 0) {
    return {
      status: "idle",
      persisted: true,
      revision: record.revision,
      ticks: 0,
      spectators,
      state,
      events,
    };
  }

  const revision = await session.save({
    state,
    events,
    tickedAt: ticks > 0 ? new Date(now) : null,
  });

  return {
    status: "ticked",
    persisted: true,
    revision,
    ticks,
    spectators,
    state,
    events,
  };
}

async function withWard(options: AdvanceOptions): Promise<WardOutcome> {
  const held = await withWardLock((session) => advanceWard(session, options));
  if (held) return held;

  return outcome("busy", await readWard());
}

export async function tickWard(
  options: AdvanceOptions = {},
): Promise<WardOutcome> {
  if (!isAsylumConfigured()) return previewWard(options.now);

  const snapshot = await readWard();
  if (snapshot.spectators <= 0) return outcome("dormant", snapshot);

  return withWard({ catchUp: true, ...options });
}

export async function watchWard(
  spectator: Spectator,
  options: AdvanceOptions = {},
): Promise<WardOutcome> {
  if (!isAsylumConfigured()) return previewWard(options.now);

  await touchSpectator(spectator.id, spectator.kind, SPECTATOR_TTL_SECONDS);
  return withWard({ catchUp: true, ...options });
}

export async function visitWard(
  input: { spectator: Spectator; act: VisitorAct },
  options: AdvanceOptions = {},
): Promise<WardOutcome> {
  if (!isAsylumConfigured()) return previewWard(options.now);

  await touchSpectator(input.spectator.id, input.spectator.kind, SPECTATOR_TTL_SECONDS);
  return withWard({ catchUp: true, ...options, visit: input.act });
}

export async function guardWardWrite(bucket: string) {
  if (!isAsylumConfigured()) return { allowed: true as const, retryAfter: 0 };
  return consumeWardLimit(bucket);
}

export type { SpectatorKind, WardDelta, WardSnapshot };
