import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { ensureSchema } from "@/lib/migrations";

type MigrationGlobal = typeof globalThis & { schemaMigration?: Promise<void> };

afterEach(() => {
  delete (globalThis as MigrationGlobal).schemaMigration;
  vi.restoreAllMocks();
});

/** A pool that records how many times a migration run actually reached the database. */
function countingPool() {
  const state = { connects: 0 };
  const client = {
    query: vi.fn(async (text: string) => {
      if (typeof text === "string" && text.includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ locked: true }] };
      }
      if (typeof text === "string" && text.includes("SELECT version")) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };

  const pool = {
    connect: async () => {
      state.connects += 1;
      return client;
    },
  } as unknown as Pool;

  return { pool, state };
}

describe("the shared migration gate", () => {
  it("runs once no matter how many stores ask", async () => {
    const { pool, state } = countingPool();

    await Promise.all([
      ensureSchema(pool, []),
      ensureSchema(pool, []),
      ensureSchema(pool, []),
    ]);

    expect(state.connects).toBe(1);
  });

  it("hands every caller the same promise", () => {
    const { pool } = countingPool();

    expect(ensureSchema(pool, [])).toBe(ensureSchema(pool, []));
  });

  it("lets a later caller retry after a failure instead of caching it forever", async () => {
    const failing = {
      connect: async () => {
        throw new Error("database asleep");
      },
    } as unknown as Pool;

    await expect(ensureSchema(failing, [])).rejects.toThrow("database asleep");

    const { pool, state } = countingPool();
    await ensureSchema(pool, []);

    expect(state.connects).toBe(1);
  });
});
