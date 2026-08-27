import "server-only";

import type { Pool } from "pg";

export type Migration = { version: number; sql: string };

const LOCK_NAMESPACE = 1_952_805_748;
const LOCK_ID = 1;
const LOCK_ATTEMPTS = 40;
const LOCK_RETRY_MS = 250;

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
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
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS canvas_rate_limits (
        bucket text NOT NULL,
        window_start timestamptz NOT NULL,
        hits integer NOT NULL DEFAULT 0,
        PRIMARY KEY (bucket, window_start)
      );

      CREATE INDEX IF NOT EXISTS canvas_rate_limits_window
        ON canvas_rate_limits (window_start);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS canvas_trash (
        room_id text NOT NULL,
        revision bigint NOT NULL,
        pixels jsonb NOT NULL,
        pixel_count integer NOT NULL,
        discarded_by text NOT NULL,
        discarded_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_id, revision)
      );

      CREATE INDEX IF NOT EXISTS canvas_trash_discarded
        ON canvas_trash (room_id, discarded_at DESC);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS asylum_ward (
        room_id text PRIMARY KEY,
        revision bigint NOT NULL DEFAULT 0,
        seed integer NOT NULL,
        state jsonb NOT NULL,
        ticked_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS asylum_events (
        room_id text NOT NULL,
        revision bigint NOT NULL,
        seq smallint NOT NULL,
        tick integer NOT NULL,
        kind varchar(24) NOT NULL,
        event jsonb NOT NULL,
        line text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_id, revision, seq)
      );

      CREATE TABLE IF NOT EXISTS asylum_spectators (
        room_id text NOT NULL,
        spectator_id text NOT NULL,
        kind varchar(8) NOT NULL,
        last_seen timestamptz NOT NULL DEFAULT NOW(),
        expires_at timestamptz NOT NULL,
        PRIMARY KEY (room_id, spectator_id)
      );

      CREATE INDEX IF NOT EXISTS asylum_spectators_expiry
        ON asylum_spectators (room_id, expires_at);

      CREATE TABLE IF NOT EXISTS asylum_spend (
        budget_key text NOT NULL,
        window_start timestamptz NOT NULL,
        calls integer NOT NULL DEFAULT 0,
        tokens bigint NOT NULL DEFAULT 0,
        micro_usd bigint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (budget_key, window_start)
      );

      CREATE INDEX IF NOT EXISTS asylum_spend_window
        ON asylum_spend (window_start);
    `,
  },
];

export function pendingMigrations(
  appliedVersions: readonly number[],
  migrations: readonly Migration[] = MIGRATIONS,
) {
  const applied = new Set(appliedVersions);
  return [...migrations]
    .sort((first, second) => first.version - second.version)
    .filter(({ version }) => !applied.has(version));
}

async function applyPending(pool: Pool, migrations: readonly Migration[]) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1, $2) AS locked",
      [LOCK_NAMESPACE, LOCK_ID],
    );

    if (!lock.rows[0].locked) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version integer PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    const applied = await client.query<{ version: number }>(
      "SELECT version FROM schema_migrations",
    );

    for (const migration of pendingMigrations(
      applied.rows.map(({ version }) => version),
      migrations,
    )) {
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [
        migration.version,
      ]);
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(
  pool: Pool,
  migrations: readonly Migration[] = MIGRATIONS,
) {
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    if (await applyPending(pool, migrations)) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }

  throw new Error("Canvas migrations are held by another instance");
}

const migrationGlobal = globalThis as typeof globalThis & {
  schemaMigration?: Promise<void>;
};

/**
 * One migration run per process, shared by every store. Each store owns its own pool but
 * they all contend for the same advisory lock, so letting two bootstraps race made the
 * loser spin for ten seconds before giving up.
 */
export function ensureSchema(
  pool: Pool,
  migrations: readonly Migration[] = MIGRATIONS,
) {
  migrationGlobal.schemaMigration ??= runMigrations(pool, migrations).catch(
    (error: unknown) => {
      migrationGlobal.schemaMigration = undefined;
      throw error;
    },
  );

  return migrationGlobal.schemaMigration;
}
