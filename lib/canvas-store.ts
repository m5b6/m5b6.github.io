import "server-only";

import { Client, Pool, type PoolClient } from "pg";
import {
  CANVAS_ROOM_ID,
  deduplicatePixels,
  type CanvasSnapshot,
  type ParticipantIdentity,
  type PixelChange,
  type Point,
  type StoredParticipant,
} from "@/lib/canvas";

const eventChannel = "matias_canvas_events";
const roomId =
  process.env.CANVAS_ROOM_ID ??
  (process.env.VERCEL_ENV === "production"
    ? CANVAS_ROOM_ID
    : `${CANVAS_ROOM_ID}:${process.env.VERCEL_ENV ?? "development"}`);
const databaseGlobal = globalThis as typeof globalThis & {
  canvasPool?: Pool;
  canvasSchema?: Promise<void>;
};

function connectionString(unpooled = false) {
  const value = unpooled
    ? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;

  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function pool() {
  databaseGlobal.canvasPool ??= new Pool({
    connectionString: connectionString(),
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    application_name: "matiasberrios-canvas",
  });

  return databaseGlobal.canvasPool;
}

async function initializeSchema() {
  await pool().query(`
    CREATE TABLE IF NOT EXISTS canvas_pixels (
      room_id text NOT NULL,
      x smallint NOT NULL,
      y smallint NOT NULL,
      color varchar(16) NOT NULL,
      updated_by text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, x, y)
    );

    CREATE TABLE IF NOT EXISTS canvas_participants (
      room_id text NOT NULL,
      participant_id text NOT NULL,
      name varchar(32) NOT NULL,
      color varchar(16) NOT NULL,
      kind varchar(8) NOT NULL,
      status varchar(60),
      cursor_x smallint,
      cursor_y smallint,
      last_seen timestamptz NOT NULL DEFAULT NOW(),
      expires_at timestamptz NOT NULL,
      PRIMARY KEY (room_id, participant_id)
    );

    CREATE INDEX IF NOT EXISTS canvas_participants_expiry
      ON canvas_participants (room_id, expires_at);

    CREATE TABLE IF NOT EXISTS canvas_meta (
      room_id text PRIMARY KEY,
      revision bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );

  `);
  await pool().query(
    "INSERT INTO canvas_meta (room_id) VALUES ($1) ON CONFLICT (room_id) DO NOTHING",
    [roomId],
  );
}

export async function ensureCanvasSchema() {
  databaseGlobal.canvasSchema ??= initializeSchema().catch((error) => {
    databaseGlobal.canvasSchema = undefined;
    throw error;
  });
  return databaseGlobal.canvasSchema;
}

async function transaction<T>(callback: (client: PoolClient) => Promise<T>) {
  await ensureCanvasSchema();
  const client = await pool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertPresence(
  client: PoolClient,
  participant: ParticipantIdentity,
  cursor: Point | null,
  status: string | null,
  ttlSeconds: number,
) {
  const result = await client.query<{ expires_at: Date }>(
    `
      INSERT INTO canvas_participants (
        room_id, participant_id, name, color, kind, status,
        cursor_x, cursor_y, last_seen, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + $9 * INTERVAL '1 second')
      ON CONFLICT (room_id, participant_id) DO UPDATE SET
        name = EXCLUDED.name,
        color = EXCLUDED.color,
        kind = EXCLUDED.kind,
        status = EXCLUDED.status,
        cursor_x = EXCLUDED.cursor_x,
        cursor_y = EXCLUDED.cursor_y,
        last_seen = NOW(),
        expires_at = EXCLUDED.expires_at
      RETURNING expires_at
    `,
    [
      roomId,
      participant.id,
      participant.name,
      participant.color,
      participant.kind,
      status,
      cursor?.x ?? null,
      cursor?.y ?? null,
      ttlSeconds,
    ],
  );

  return result.rows[0].expires_at.toISOString();
}

async function bumpRevision(client: PoolClient) {
  const result = await client.query<{ revision: string }>(
    `
      UPDATE canvas_meta
      SET revision = revision + 1, updated_at = NOW()
      WHERE room_id = $1
      RETURNING revision
    `,
    [roomId],
  );

  return Number(result.rows[0].revision);
}

async function notify(client: PoolClient, event: unknown) {
  await client.query("SELECT pg_notify($1, $2)", [eventChannel, JSON.stringify(event)]);
}

export async function getCanvasSnapshot(): Promise<CanvasSnapshot> {
  await ensureCanvasSchema();
  const [pixelResult, participantResult, metaResult] = await Promise.all([
    pool().query<{ x: number; y: number; color: string }>(
      "SELECT x, y, color FROM canvas_pixels WHERE room_id = $1",
      [roomId],
    ),
    pool().query<{
      participant_id: string;
      name: string;
      color: string;
      kind: "human" | "agent";
      status: string | null;
      cursor_x: number | null;
      cursor_y: number | null;
      expires_at: Date;
    }>(
      `
        SELECT participant_id, name, color, kind, status,
          cursor_x, cursor_y, expires_at
        FROM canvas_participants
        WHERE room_id = $1 AND expires_at > NOW()
      `,
      [roomId],
    ),
    pool().query<{ revision: string }>(
      "SELECT revision FROM canvas_meta WHERE room_id = $1",
      [roomId],
    ),
  ]);

  const pixels = Object.fromEntries(
    pixelResult.rows.map(({ x, y, color }) => [`${x}:${y}`, color]),
  );
  const participants = participantResult.rows.map(
    (row): StoredParticipant => ({
      id: row.participant_id,
      name: row.name,
      color: row.color,
      kind: row.kind,
      status: row.status,
      cursor:
        row.cursor_x === null || row.cursor_y === null
          ? null
          : { x: row.cursor_x, y: row.cursor_y },
      expiresAt: row.expires_at.toISOString(),
    }),
  );

  return {
    pixels,
    participants,
    revision: Number(metaResult.rows[0]?.revision ?? 0),
  };
}

export async function writePresence(
  participant: ParticipantIdentity,
  cursor: Point | null,
  status: string | null,
  ttlSeconds = 15,
) {
  return transaction(async (client) => {
    const expiresAt = await upsertPresence(
      client,
      participant,
      cursor,
      status,
      ttlSeconds,
    );
    const revision = await bumpRevision(client);
    await notify(client, {
      type: "presence",
      revision,
      participant: { ...participant, cursor, status, expiresAt },
    });
    return revision;
  });
}

export async function writePixels(
  participant: ParticipantIdentity,
  changes: PixelChange[],
  cursor: Point | null,
  status: string | null,
  ttlSeconds = 15,
) {
  const uniqueChanges = deduplicatePixels(changes);

  return transaction(async (client) => {
    const painted = uniqueChanges.filter(({ color }) => color !== "transparent");
    const erased = uniqueChanges.filter(({ color }) => color === "transparent");

    if (painted.length > 0) {
      await client.query(
        `
          INSERT INTO canvas_pixels (room_id, x, y, color, updated_by)
          SELECT $1, pixels.x, pixels.y, pixels.color, $5
          FROM UNNEST($2::smallint[], $3::smallint[], $4::text[])
            AS pixels(x, y, color)
          ON CONFLICT (room_id, x, y) DO UPDATE SET
            color = EXCLUDED.color,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `,
        [
          roomId,
          painted.map(({ x }) => x),
          painted.map(({ y }) => y),
          painted.map(({ color }) => color),
          participant.id,
        ],
      );
    }

    if (erased.length > 0) {
      await client.query(
        `
          DELETE FROM canvas_pixels existing
          USING UNNEST($2::smallint[], $3::smallint[]) AS erased(x, y)
          WHERE existing.room_id = $1
            AND existing.x = erased.x
            AND existing.y = erased.y
        `,
        [
          roomId,
          erased.map(({ x }) => x),
          erased.map(({ y }) => y),
        ],
      );
    }

    await upsertPresence(client, participant, cursor, status, ttlSeconds);
    const revision = await bumpRevision(client);
    await notify(client, { type: "refresh", revision });
    return revision;
  });
}

export async function clearCanvas() {
  return transaction(async (client) => {
    await client.query("DELETE FROM canvas_pixels WHERE room_id = $1", [
      roomId,
    ]);
    const revision = await bumpRevision(client);
    await notify(client, { type: "refresh", revision });
    return revision;
  });
}

export async function connectCanvasEvents() {
  await ensureCanvasSchema();
  const client = new Client({
    connectionString: connectionString(true),
    application_name: "matiasberrios-canvas-events",
  });
  await client.connect();
  await client.query(`LISTEN ${eventChannel}`);
  return client;
}

export function isCanvasConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
