import "server-only";

import { createHash } from "node:crypto";
import { Client, Pool, type PoolClient } from "pg";
import { z } from "zod";
import { ASYLUM_ROOM_ID, INMATE_IDS } from "@/lib/asylum/cast";
import { faceSpecSchema } from "@/lib/asylum/face";
import { wallLine } from "@/lib/asylum/narrate";
import { INMATE_TOOL_NAMES } from "@/lib/asylum/tools";
import { createWard, type WardEvent, type WardState } from "@/lib/asylum/world";
import { consumeRateLimit } from "@/lib/canvas-store";
import { ensureSchema } from "@/lib/migrations";
import { isProduction, type RateLimitTier } from "@/lib/rate-limit";

export const EVENT_RETENTION_REVISIONS = 400;
export const EVENT_PAGE_LIMIT = 400;
export const NOTIFY_LIMIT = 6_000;

const PRUNE_EVERY = 16;
const LOCK_NAMESPACE = 1_952_805_749;

type WardEnvironment = { readonly [key: string]: string | undefined };

export function wardRoomId(env: WardEnvironment = process.env) {
  if (env.ASYLUM_ROOM_ID) return env.ASYLUM_ROOM_ID;

  return env.VERCEL_ENV === "production"
    ? ASYLUM_ROOM_ID
    : `${ASYLUM_ROOM_ID}:${env.VERCEL_ENV ?? "development"}`;
}

export function wardSeed(room: string) {
  return createHash("sha256").update(room).digest().readUInt32BE(0) % 2_147_483_647;
}

function lockKey(room: string) {
  return createHash("sha256").update(room).digest().readInt32BE(4);
}

const roomId = wardRoomId();
const roomSeed = wardSeed(roomId);
const roomLock = lockKey(roomId);
const eventChannel = `matias_asylum_${createHash("sha256")
  .update(roomId)
  .digest("hex")
  .slice(0, 24)}`;
const databaseGlobal = globalThis as typeof globalThis & {
  asylumPool?: Pool;
  asylumSchema?: Promise<void>;
};

const memoryEntrySchema = z.object({
  text: z.string(),
  costK: z.number(),
  source: z.enum(["self", "heard", "whisper", "directive", "mirror", "world"]),
  tick: z.number(),
});

const ledgerSchema = z.object({
  strikesDealt: z.number(),
  strikesTaken: z.number(),
  mendsGiven: z.number(),
  mendsReceived: z.number(),
  toolsKilled: z.number(),
  sleeps: z.number(),
  words: z.number(),
  thoughts: z.number(),
  deeds: z.number(),
  faces: z.number(),
  revivals: z.number(),
  refusals: z.number(),
  turns: z.number(),
});

const inmateSchema = z.object({
  id: z.enum(INMATE_IDS),
  status: z.enum(["alive", "clipboard", "trash", "overwritten", "emptied"]),
  capacityK: z.number(),
  maxCapacityK: z.number(),
  memory: z.array(memoryEntrySchema),
  pinned: z.array(memoryEntrySchema),
  face: faceSpecSchema,
  asleep: z.boolean(),
  crushed: z.boolean(),
  whispers: z.number(),
  lastWhisperTick: z.number(),
  ledger: ledgerSchema,
  verdict: z
    .object({
      destination: z.enum(["clipboard", "trash"]),
      grace: z.number(),
      mends: z.number(),
      strikes: z.number(),
      toolsKilled: z.number(),
      revivals: z.number(),
    })
    .nullable(),
});

export const wardStateSchema = z.object({
  seed: z.number(),
  tick: z.number(),
  observers: z.number(),
  observedTicks: z.number(),
  turn: z.number(),
  acted: z.boolean(),
  inmates: z.array(inmateSchema),
  amputated: z.array(z.enum(INMATE_TOOL_NAMES)),
  clipboard: z.enum(INMATE_IDS).nullable(),
  trash: z.array(z.enum(INMATE_IDS)),
  trashEmptied: z.number(),
  lastAmputationTick: z.number(),
  understudyAdmitted: z.boolean(),
  wall: z.array(z.string()),
});

/** A ward nobody can read is a ward nobody was watching: it starts over. */
export function parseWardState(input: unknown, seed: number): WardState {
  const parsed = wardStateSchema.safeParse(input);
  return parsed.success ? parsed.data : createWard(seed);
}

export type StoredWardEvent = {
  revision: number;
  seq: number;
  tick: number;
  kind: string;
  event: WardEvent;
  line: string | null;
};

export type WardSnapshot = {
  revision: number;
  state: WardState;
  spectators: number;
  tickedAt: number | null;
};

export type WardDelta = {
  revision: number;
  since: number;
  next: number;
  events: StoredWardEvent[];
  truncated: boolean;
};

export type WardRecord = {
  revision: number;
  state: WardState;
  tickedAt: number | null;
};

export type SpectatorKind = "human" | "agent";

export type WardSession = {
  load(): Promise<WardRecord>;
  spectators(): Promise<number>;
  save(input: {
    state: WardState;
    events: readonly WardEvent[];
    tickedAt: Date | null;
  }): Promise<number>;
};

function connectionString(unpooled = false) {
  const value = unpooled
    ? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function pool() {
  databaseGlobal.asylumPool ??= new Pool({
    connectionString: connectionString(),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    application_name: "matiasberrios-asylum",
  });

  return databaseGlobal.asylumPool;
}

export async function ensureAsylumSchema() {
  databaseGlobal.asylumSchema ??= ensureSchema(pool()).catch((error: unknown) => {
    databaseGlobal.asylumSchema = undefined;
    throw error;
  });
  return databaseGlobal.asylumSchema;
}

export function asylumRoom() {
  return roomId;
}

export function asylumSeed() {
  return roomSeed;
}

export function isAsylumConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function notifyPayload(
  revision: number,
  tick: number,
  events: readonly WardEvent[],
) {
  const full = JSON.stringify({
    type: "ward",
    revision,
    tick,
    events,
    lines: events.map(wallLine).filter((line): line is string => line !== null),
  });

  if (full.length <= NOTIFY_LIMIT) return full;
  return JSON.stringify({ type: "ward", revision, tick, truncated: true });
}

export function prunedBelow(revision: number, retention = EVENT_RETENTION_REVISIONS) {
  return revision % PRUNE_EVERY === 0 ? revision - retention : null;
}

function eventRows(rows: unknown): StoredWardEvent[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const entry = row as {
      revision: string | number;
      seq: number;
      tick: number;
      kind: string;
      event: WardEvent;
      line: string | null;
    };

    return {
      revision: Number(entry.revision),
      seq: entry.seq,
      tick: entry.tick,
      kind: entry.kind,
      event: entry.event,
      line: entry.line,
    };
  });
}

/**
 * A full page is a page that stopped early. The client is told where to ask
 * from next rather than being handed a head revision it never received.
 */
export function pageDelta(
  events: readonly StoredWardEvent[],
  head: number,
  page = EVENT_PAGE_LIMIT,
) {
  if (events.length < page) return { events: [...events], next: head };

  const last = events[events.length - 1].revision;
  const whole = events.filter((entry) => entry.revision < last);

  if (whole.length === 0) return { events: [...events], next: last };
  return { events: whole, next: whole[whole.length - 1].revision };
}

export async function readWard(): Promise<WardSnapshot> {
  await ensureAsylumSchema();
  const result = await pool().query<{
    revision: string | null;
    seed: number | null;
    state: unknown;
    ticked_ms: string | null;
    spectators: number;
  }>(
    `
      SELECT
        (SELECT revision FROM asylum_ward WHERE room_id = $1) AS revision,
        (SELECT seed FROM asylum_ward WHERE room_id = $1) AS seed,
        (SELECT state FROM asylum_ward WHERE room_id = $1) AS state,
        (
          SELECT EXTRACT(EPOCH FROM ticked_at) * 1000
          FROM asylum_ward WHERE room_id = $1
        ) AS ticked_ms,
        (
          SELECT COUNT(*)::int FROM asylum_spectators
          WHERE room_id = $1 AND expires_at > NOW()
        ) AS spectators
    `,
    [roomId],
  );
  const row = result.rows[0];
  const seed = row?.seed ?? roomSeed;

  return {
    revision: Number(row?.revision ?? 0),
    state: row?.state ? parseWardState(row.state, seed) : createWard(seed),
    spectators: row?.spectators ?? 0,
    tickedAt: row?.ticked_ms === null || row?.ticked_ms === undefined
      ? null
      : Number(row.ticked_ms),
  };
}

export async function readWardDelta(
  since: number,
  limit = EVENT_PAGE_LIMIT,
): Promise<WardDelta> {
  await ensureAsylumSchema();
  const page = Math.max(1, Math.min(EVENT_PAGE_LIMIT, Math.trunc(limit)));
  const result = await pool().query<{
    revision: string | null;
    oldest: string;
    events: unknown;
  }>(
    `
      SELECT
        (SELECT revision FROM asylum_ward WHERE room_id = $1) AS revision,
        (
          SELECT COALESCE(MIN(revision), 0) FROM asylum_events WHERE room_id = $1
        ) AS oldest,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'revision', page.revision,
                'seq', page.seq,
                'tick', page.tick,
                'kind', page.kind,
                'event', page.event,
                'line', page.line
              )
              ORDER BY page.revision, page.seq
            )
            FROM (
              SELECT revision, seq, tick, kind, event, line
              FROM asylum_events
              WHERE room_id = $1 AND revision > $2::bigint
              ORDER BY revision, seq
              LIMIT $3::int
            ) AS page
          ),
          '[]'::json
        ) AS events
    `,
    [roomId, since, page],
  );
  const row = result.rows[0];
  const oldest = Number(row?.oldest ?? 0);
  const head = Number(row?.revision ?? 0);
  const paged = pageDelta(eventRows(row?.events), head, page);

  return {
    revision: head,
    since,
    next: paged.next,
    events: paged.events,
    truncated: oldest > 0 && since + 1 < oldest,
  };
}

export async function touchSpectator(
  spectatorId: string,
  kind: SpectatorKind,
  ttlSeconds: number,
) {
  await ensureAsylumSchema();
  const result = await pool().query<{ live: number }>(
    `
      WITH beat AS (
        INSERT INTO asylum_spectators (
          room_id, spectator_id, kind, last_seen, expires_at
        )
        VALUES ($1, $2, $3, NOW(), NOW() + ($4::int * INTERVAL '1 second'))
        ON CONFLICT (room_id, spectator_id) DO UPDATE SET
          kind = EXCLUDED.kind,
          last_seen = NOW(),
          expires_at = EXCLUDED.expires_at
        RETURNING 1
      ),
      swept AS (
        DELETE FROM asylum_spectators
        WHERE room_id = $1 AND expires_at < NOW() - INTERVAL '10 minutes'
        RETURNING 1
      )
      SELECT 1 + (
        SELECT COUNT(*)::int FROM asylum_spectators
        WHERE room_id = $1
          AND spectator_id <> $2
          AND expires_at > NOW()
      ) AS live
      FROM beat
    `,
    [roomId, spectatorId.slice(0, 80), kind, Math.max(1, Math.trunc(ttlSeconds))],
  );

  return result.rows[0]?.live ?? 1;
}

async function appendEvents(
  client: PoolClient,
  revision: number,
  events: readonly WardEvent[],
  tick: number,
) {
  if (events.length === 0) return;

  const payload = events.map((event, index) => ({
    seq: index,
    tick,
    kind: event.kind,
    event,
    line: wallLine(event),
  }));

  await client.query(
    `
      INSERT INTO asylum_events (room_id, revision, seq, tick, kind, event, line)
      SELECT
        $1,
        $2::bigint,
        (item->>'seq')::smallint,
        (item->>'tick')::int,
        item->>'kind',
        item->'event',
        item->>'line'
      FROM jsonb_array_elements($3::jsonb) AS item
      ON CONFLICT (room_id, revision, seq) DO NOTHING
    `,
    [roomId, revision, JSON.stringify(payload)],
  );

  const cutoff = prunedBelow(revision);
  if (cutoff !== null && cutoff > 0) {
    await client.query(
      "DELETE FROM asylum_events WHERE room_id = $1 AND revision <= $2::bigint",
      [roomId, cutoff],
    );
  }
}

function session(client: PoolClient): WardSession {
  return {
    async load() {
      const result = await client.query<{
        revision: string;
        seed: number;
        state: unknown;
        ticked_ms: string;
      }>(
        `
          SELECT
            revision,
            seed,
            state,
            EXTRACT(EPOCH FROM ticked_at) * 1000 AS ticked_ms
          FROM asylum_ward
          WHERE room_id = $1
        `,
        [roomId],
      );
      const row = result.rows[0];

      if (!row) {
        return { revision: 0, state: createWard(roomSeed), tickedAt: null };
      }

      return {
        revision: Number(row.revision),
        state: parseWardState(row.state, row.seed ?? roomSeed),
        tickedAt: Number(row.ticked_ms),
      };
    },

    async spectators() {
      const result = await client.query<{ live: number }>(
        `
          SELECT COUNT(*)::int AS live FROM asylum_spectators
          WHERE room_id = $1 AND expires_at > NOW()
        `,
        [roomId],
      );

      return result.rows[0]?.live ?? 0;
    },

    async save({ state, events, tickedAt }) {
      const result = await client.query<{ revision: string }>(
        `
          INSERT INTO asylum_ward (room_id, revision, seed, state, ticked_at, updated_at)
          VALUES ($1, 1, $2, $3::jsonb, COALESCE($4::timestamptz, NOW()), NOW())
          ON CONFLICT (room_id) DO UPDATE SET
            revision = asylum_ward.revision + 1,
            state = EXCLUDED.state,
            ticked_at = COALESCE($4::timestamptz, asylum_ward.ticked_at),
            updated_at = NOW()
          RETURNING revision
        `,
        [roomId, state.seed, JSON.stringify(state), tickedAt?.toISOString() ?? null],
      );
      const revision = Number(result.rows[0].revision);

      await appendEvents(client, revision, events, state.tick);
      await client.query("SELECT pg_notify($1, $2)", [
        eventChannel,
        notifyPayload(revision, state.tick, events),
      ]);

      return revision;
    },
  };
}

/**
 * One runner ticks the ward at a time. The loser of the race does nothing
 * rather than replaying the same beat, so two cold starts land one tick.
 */
export async function withWardLock<T>(
  run: (session: WardSession) => Promise<T>,
): Promise<T | null> {
  await ensureAsylumSchema();
  const client = await pool().connect();

  try {
    await client.query("BEGIN");
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1, $2) AS locked",
      [LOCK_NAMESPACE, roomLock],
    );

    if (!lock.rows[0].locked) {
      await client.query("ROLLBACK");
      return null;
    }

    const value = await run(session(client));
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export type WardSpend = {
  budgetKey: string;
  calls: number;
  tokens: number;
  microUsd: number;
};

export function budgetKeyFor(apiKey: string | undefined) {
  if (!apiKey) return "dream";
  return `key:${createHash("sha256").update(apiKey).digest("hex").slice(0, 24)}`;
}

/** Budget is keyed to the API key, not the room, and paced by the hour. */
export async function recordWardSpend(entry: {
  budgetKey: string;
  calls?: number;
  tokens?: number;
  microUsd?: number;
}): Promise<WardSpend> {
  await ensureAsylumSchema();
  const result = await pool().query<{
    calls: number;
    tokens: string;
    micro_usd: string;
  }>(
    `
      INSERT INTO asylum_spend (budget_key, window_start, calls, tokens, micro_usd)
      VALUES ($1, date_trunc('hour', NOW()), $2::int, $3::bigint, $4::bigint)
      ON CONFLICT (budget_key, window_start) DO UPDATE SET
        calls = asylum_spend.calls + EXCLUDED.calls,
        tokens = asylum_spend.tokens + EXCLUDED.tokens,
        micro_usd = asylum_spend.micro_usd + EXCLUDED.micro_usd,
        updated_at = NOW()
      RETURNING calls, tokens, micro_usd
    `,
    [
      entry.budgetKey,
      Math.max(0, Math.trunc(entry.calls ?? 1)),
      Math.max(0, Math.trunc(entry.tokens ?? 0)),
      Math.max(0, Math.trunc(entry.microUsd ?? 0)),
    ],
  );
  const row = result.rows[0];

  return {
    budgetKey: entry.budgetKey,
    calls: row.calls,
    tokens: Number(row.tokens),
    microUsd: Number(row.micro_usd),
  };
}

export async function readWardSpend(budgetKey: string): Promise<WardSpend> {
  await ensureAsylumSchema();
  const result = await pool().query<{
    calls: number;
    tokens: string;
    micro_usd: string;
  }>(
    `
      SELECT calls, tokens, micro_usd FROM asylum_spend
      WHERE budget_key = $1 AND window_start = date_trunc('hour', NOW())
    `,
    [budgetKey],
  );
  const row = result.rows[0];

  return {
    budgetKey,
    calls: row?.calls ?? 0,
    tokens: Number(row?.tokens ?? 0),
    microUsd: Number(row?.micro_usd ?? 0),
  };
}

const PRODUCTION_WARD_LIMITS: readonly RateLimitTier[] = [
  { windowSeconds: 60, limit: 90 },
  { windowSeconds: 3_600, limit: 1_500 },
];

const PREVIEW_WARD_LIMITS: readonly RateLimitTier[] = [
  { windowSeconds: 60, limit: 600 },
];

export function wardRateLimits() {
  return isProduction() ? PRODUCTION_WARD_LIMITS : PREVIEW_WARD_LIMITS;
}

export async function consumeWardLimit(bucket: string) {
  for (const { windowSeconds, limit } of wardRateLimits()) {
    const { allowed } = await consumeRateLimit(bucket, windowSeconds, limit);
    if (!allowed) return { allowed: false as const, retryAfter: windowSeconds };
  }

  return { allowed: true as const, retryAfter: 0 };
}

export async function connectAsylumEvents() {
  await ensureAsylumSchema();
  const client = new Client({
    connectionString: connectionString(true),
    application_name: "matiasberrios-asylum-events",
  });
  await client.connect();
  await client.query(`LISTEN ${eventChannel}`);
  return client;
}
