import "server-only";

import { createHash } from "node:crypto";
import { Client, Pool, type PoolClient } from "pg";
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
import { runMigrations } from "@/lib/migrations";
import { resolveRoomId } from "@/lib/canvas-room";
import {
  MAX_TRASH_ENTRIES,
  type RestoreResult,
  type TrashEntry,
} from "@/lib/trash";

type CanvasStoreEvent =
  | { type: "clear"; revision: number }
  | { type: "refresh"; revision: number };

const roomId = resolveRoomId();
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
  await runMigrations(pool());
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

async function inTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  await ensureCanvasSchema();
  const client = await pool().connect();

  try {
    await client.query("BEGIN");
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

async function announce(client: PoolClient, event: CanvasStoreEvent) {
  await client.query("SELECT pg_notify($1, $2)", [
    eventChannel,
    JSON.stringify(event),
  ]);
}

/**
 * Clearing moves the painting into the Trash instead of destroying it. The wire
 * contract is unchanged: callers still receive the new revision and every live
 * client still receives one `clear` event.
 */
export async function clearCanvas(discardedBy = "unknown") {
  return inTransaction(async (client) => {
    const revision = await bumpRevision(client);

    await client.query(
      `
        INSERT INTO canvas_trash (room_id, revision, pixels, pixel_count, discarded_by)
        SELECT
          $1,
          $2::bigint,
          COALESCE(
            jsonb_object_agg(
              canvas_pixels.x::text || ':' || canvas_pixels.y::text,
              canvas_pixels.color
            ),
            '{}'::jsonb
          ),
          COUNT(*)::int,
          $3
        FROM canvas_pixels
        WHERE canvas_pixels.room_id = $1
        HAVING COUNT(*) > 0
        ON CONFLICT (room_id, revision) DO NOTHING
      `,
      [roomId, revision, discardedBy.slice(0, 80)],
    );
    await client.query("DELETE FROM canvas_pixels WHERE room_id = $1", [roomId]);
    await announce(client, { type: "clear", revision });

    return revision;
  });
}

export async function listTrash(limit = MAX_TRASH_ENTRIES): Promise<TrashEntry[]> {
  await ensureCanvasSchema();
  const result = await pool().query<{
    revision: string;
    pixel_count: number;
    discarded_by: string;
    discarded_at: Date;
  }>(
    `
      SELECT revision, pixel_count, discarded_by, discarded_at
      FROM canvas_trash
      WHERE room_id = $1
      ORDER BY discarded_at DESC, revision DESC
      LIMIT $2
    `,
    [roomId, Math.max(1, Math.min(MAX_TRASH_ENTRIES, limit))],
  );

  return result.rows.map((row) => ({
    revision: Number(row.revision),
    pixelCount: row.pixel_count,
    discardedBy: row.discarded_by,
    discardedAt: row.discarded_at.toISOString(),
  }));
}

/**
 * Put Back: the newest discarded painting returns to the canvas and leaves the
 * Trash. Pixels painted after the clear are kept; the restored ones win ties.
 */
export async function restoreTrash(
  restoredBy: string,
  revision?: number,
): Promise<RestoreResult> {
  return inTransaction(async (client) => {
    const discarded = await client.query<{ revision: string; pixel_count: number }>(
      revision === undefined
        ? `
          SELECT revision, pixel_count FROM canvas_trash
          WHERE room_id = $1
          ORDER BY discarded_at DESC, revision DESC
          LIMIT 1
          FOR UPDATE
        `
        : `
          SELECT revision, pixel_count FROM canvas_trash
          WHERE room_id = $1 AND revision = $2::bigint
          FOR UPDATE
        `,
      revision === undefined ? [roomId] : [roomId, revision],
    );
    const entry = discarded.rows[0];
    if (!entry) return { restored: false as const };

    await client.query(
      `
        INSERT INTO canvas_pixels (room_id, x, y, color, updated_by)
        SELECT
          $1,
          split_part(restored.key, ':', 1)::smallint,
          split_part(restored.key, ':', 2)::smallint,
          restored.value,
          $3
        FROM canvas_trash
        CROSS JOIN LATERAL jsonb_each_text(canvas_trash.pixels) AS restored(key, value)
        WHERE canvas_trash.room_id = $1 AND canvas_trash.revision = $2::bigint
        ON CONFLICT (room_id, x, y) DO UPDATE SET
          color = EXCLUDED.color,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `,
      [roomId, entry.revision, restoredBy.slice(0, 80)],
    );
    await client.query(
      "DELETE FROM canvas_trash WHERE room_id = $1 AND revision = $2::bigint",
      [roomId, entry.revision],
    );

    const nextRevision = await bumpRevision(client);
    await announce(client, { type: "refresh", revision: nextRevision });

    return {
      restored: true as const,
      revision: nextRevision,
      pixelCount: entry.pixel_count,
    };
  });
}

/** Empty Trash is the irreversible act. Nothing else in the shell destroys art. */
export async function emptyTrash() {
  await ensureCanvasSchema();
  const result = await pool().query(
    "DELETE FROM canvas_trash WHERE room_id = $1",
    [roomId],
  );

  return result.rowCount ?? 0;
}

export async function consumeRateLimit(
  bucket: string,
  windowSeconds: number,
  limit: number,
) {
  await ensureCanvasSchema();
  const result = await pool().query<{ hits: number }>(
    `
      INSERT INTO canvas_rate_limits (bucket, window_start, hits)
      VALUES (
        $1,
        to_timestamp(
          floor(EXTRACT(EPOCH FROM NOW()) / $2::int) * $2::int
        ),
        1
      )
      ON CONFLICT (bucket, window_start)
        DO UPDATE SET hits = canvas_rate_limits.hits + 1
      RETURNING hits
    `,
    [bucket, windowSeconds],
  );
  const hits = result.rows[0].hits;

  if (hits === 1 && bucket.endsWith("00")) {
    void pool()
      .query(
        "DELETE FROM canvas_rate_limits WHERE window_start < NOW() - INTERVAL '2 days'",
      )
      .catch(() => {});
  }

  return { allowed: hits <= limit, hits };
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
