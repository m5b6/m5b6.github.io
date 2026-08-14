import "server-only";

import { createHash } from "node:crypto";
import { Client, Pool } from "pg";
import {
  CANVAS_ROOM_ID,
  deduplicatePixels,
  type CanvasSnapshot,
  type ParticipantIdentity,
  type PixelChange,
  type PixelTuple,
  type Point,
  type StoredParticipant,
} from "@/lib/canvas";

const roomId =
  process.env.CANVAS_ROOM_ID ??
  (process.env.VERCEL_ENV === "production"
    ? CANVAS_ROOM_ID
    : `${CANVAS_ROOM_ID}:${process.env.VERCEL_ENV ?? "development"}`);
const eventChannel = `matias_canvas_${createHash("sha256")
  .update(roomId)
  .digest("hex")
  .slice(0, 24)}`;
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

export async function getCanvasSnapshot(): Promise<CanvasSnapshot> {
  await ensureCanvasSchema();
  const result = await pool().query<{
    pixels: Record<string, string>;
    participants: StoredParticipant[];
    revision: string;
  }>(
    `
      SELECT
        COALESCE(
          (
            SELECT json_object_agg(
              canvas_pixels.x::text || ':' || canvas_pixels.y::text,
              canvas_pixels.color
            )
            FROM canvas_pixels
            WHERE canvas_pixels.room_id = $1
          ),
          '{}'::json
        ) AS pixels,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', canvas_participants.participant_id,
                'name', canvas_participants.name,
                'color', canvas_participants.color,
                'kind', canvas_participants.kind,
                'status', canvas_participants.status,
                'cursor', CASE
                  WHEN canvas_participants.cursor_x IS NULL
                    OR canvas_participants.cursor_y IS NULL
                    THEN NULL
                  ELSE json_build_object(
                    'x', canvas_participants.cursor_x,
                    'y', canvas_participants.cursor_y
                  )
                END,
                'expiresAt', canvas_participants.expires_at
              )
            )
            FROM canvas_participants
            WHERE canvas_participants.room_id = $1
              AND canvas_participants.expires_at > NOW()
          ),
          '[]'::json
        ) AS participants,
        canvas_meta.revision
      FROM canvas_meta
      WHERE canvas_meta.room_id = $1
    `,
    [roomId],
  );
  const snapshot = result.rows[0];

  return {
    pixels: snapshot?.pixels ?? {},
    participants: snapshot?.participants ?? [],
    revision: Number(snapshot?.revision ?? 0),
  };
}

export async function writePresence(
  participant: ParticipantIdentity,
  cursor: Point | null,
  status: string | null,
  ttlSeconds = 15,
) {
  await ensureCanvasSchema();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1_000).toISOString();
  const event = JSON.stringify({
    type: "presence",
    participant: { ...participant, cursor, status, expiresAt },
  });

  await pool().query(
    `
      WITH updated_participant AS (
        INSERT INTO canvas_participants (
          room_id, participant_id, name, color, kind, status,
          cursor_x, cursor_y, last_seen, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9::timestamptz)
        ON CONFLICT (room_id, participant_id) DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          kind = EXCLUDED.kind,
          status = EXCLUDED.status,
          cursor_x = EXCLUDED.cursor_x,
          cursor_y = EXCLUDED.cursor_y,
          last_seen = NOW(),
          expires_at = EXCLUDED.expires_at
        RETURNING 1
      )
      SELECT pg_notify($10, $11) FROM updated_participant
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
      expiresAt,
      eventChannel,
      event,
    ],
  );

  return 0;
}

export async function writePixels(
  participant: ParticipantIdentity,
  changes: PixelChange[],
  cursor: Point | null,
  status: string | null,
  ttlSeconds = 15,
) {
  await ensureCanvasSchema();
  const uniqueChanges = deduplicatePixels(changes);
  const painted = uniqueChanges.filter(({ color }) => color !== "transparent");
  const erased = uniqueChanges.filter(({ color }) => color === "transparent");
  const expiresAt = new Date(Date.now() + ttlSeconds * 1_000).toISOString();
  const visibleParticipant = JSON.stringify({
    ...participant,
    cursor,
    status,
    expiresAt,
  });
  const pixels: PixelTuple[] = uniqueChanges.map(({ x, y, color }) => [
    x,
    y,
    color,
  ]);

  const result = await pool().query<{ revision: string }>(
    `
      WITH painted_pixels AS (
        INSERT INTO canvas_pixels (room_id, x, y, color, updated_by)
        SELECT $1, pixels.x, pixels.y, pixels.color, $7
        FROM UNNEST($2::smallint[], $3::smallint[], $4::text[])
          AS pixels(x, y, color)
        ON CONFLICT (room_id, x, y) DO UPDATE SET
          color = EXCLUDED.color,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING 1
      ),
      erased_pixels AS (
        DELETE FROM canvas_pixels existing
        USING UNNEST($5::smallint[], $6::smallint[]) AS erased(x, y)
        WHERE existing.room_id = $1
          AND existing.x = erased.x
          AND existing.y = erased.y
        RETURNING 1
      ),
      updated_participant AS (
        INSERT INTO canvas_participants (
          room_id, participant_id, name, color, kind, status,
          cursor_x, cursor_y, last_seen, expires_at
        )
        VALUES ($1, $7, $8, $9, $10, $11, $12, $13, NOW(), $14::timestamptz)
        ON CONFLICT (room_id, participant_id) DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          kind = EXCLUDED.kind,
          status = EXCLUDED.status,
          cursor_x = EXCLUDED.cursor_x,
          cursor_y = EXCLUDED.cursor_y,
          last_seen = NOW(),
          expires_at = EXCLUDED.expires_at
        RETURNING 1
      ),
      next_revision AS (
        UPDATE canvas_meta
        SET revision = revision + 1, updated_at = NOW()
        WHERE room_id = $1
        RETURNING revision
      )
      SELECT next_revision.revision,
        pg_notify(
          $15,
          json_build_object(
            'type', 'pixels',
            'revision', next_revision.revision,
            'participant', $16::json,
            'pixels', $17::json
          )::text
        ) AS notified
      FROM next_revision CROSS JOIN updated_participant
    `,
    [
      roomId,
      painted.map(({ x }) => x),
      painted.map(({ y }) => y),
      painted.map(({ color }) => color),
      erased.map(({ x }) => x),
      erased.map(({ y }) => y),
      participant.id,
      participant.name,
      participant.color,
      participant.kind,
      status,
      cursor?.x ?? null,
      cursor?.y ?? null,
      expiresAt,
      eventChannel,
      visibleParticipant,
      JSON.stringify(pixels),
    ],
  );

  return Number(result.rows[0].revision);
}

export async function clearCanvas() {
  await ensureCanvasSchema();
  const result = await pool().query<{ revision: string }>(
    `
      WITH cleared_pixels AS (
        DELETE FROM canvas_pixels WHERE room_id = $1
      ),
      next_revision AS (
        UPDATE canvas_meta
        SET revision = revision + 1, updated_at = NOW()
        WHERE room_id = $1
        RETURNING revision
      )
      SELECT next_revision.revision,
        pg_notify(
          $2,
          json_build_object(
            'type', 'clear',
            'revision', next_revision.revision
          )::text
        ) AS notified
      FROM next_revision
    `,
    [roomId, eventChannel],
  );

  return Number(result.rows[0].revision);
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
