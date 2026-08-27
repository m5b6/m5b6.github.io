import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ASYLUM_ROOM_ID } from "./cast";

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;

  try {
    const text = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");

    for (const line of text.split("\n")) {
      const match = /^([A-Z0-9_]+)="?([^"\n]*)"?$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {}
}

loadLocalEnv();

const room = `${ASYLUM_ROOM_ID}:vitest-${randomUUID().slice(0, 8)}`;
const configured = Boolean(process.env.DATABASE_URL);

type Store = typeof import("./store");
type Engine = typeof import("./engine");

let store: Store;
let engine: Engine;
let pool: Pool;

function latch() {
  let reached = () => {};
  let open = () => {};
  const arrival = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return {
    arrival,
    opened,
    reached: () => reached(),
    open: () => open(),
  };
}

async function countRows(table: string) {
  const result = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM ${table} WHERE room_id = $1`,
    [room],
  );

  return Number(result.rows[0].total);
}

describe.skipIf(!configured)("the ward in Postgres", () => {
  beforeAll(async () => {
    expect(room).not.toBe(ASYLUM_ROOM_ID);
    process.env.ASYLUM_ROOM_ID = room;
    store = await import("./store");
    engine = await import("./engine");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      application_name: "matiasberrios-asylum-test",
    });
    await store.ensureAsylumSchema();
    expect(store.asylumRoom()).toBe(room);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;

    for (const table of ["asylum_events", "asylum_spectators", "asylum_ward"]) {
      await pool.query(`DELETE FROM ${table} WHERE room_id = $1`, [room]);
    }
    await pool.query("DELETE FROM asylum_spend WHERE budget_key = $1", [
      `test:${room}`,
    ]);
    await pool.end();
  }, 30_000);

  it("opens an empty ward without writing one down", async () => {
    const snapshot = await store.readWard();

    expect(snapshot.revision).toBe(0);
    expect(snapshot.spectators).toBe(0);
    expect(snapshot.state.tick).toBe(0);
    expect(snapshot.tickedAt).toBeNull();
    expect(await countRows("asylum_ward")).toBe(0);
  });

  it("writes absolutely nothing while nobody is watching", async () => {
    const outcome = await engine.tickWard();

    expect(outcome.status).toBe("dormant");
    expect(outcome.ticks).toBe(0);
    expect(await countRows("asylum_ward")).toBe(0);
    expect(await countRows("asylum_events")).toBe(0);
  });

  it("moves the ward once a spectator arrives", async () => {
    const outcome = await engine.watchWard({ id: "vitest-eye", kind: "human" });

    expect(outcome.status).toBe("ticked");
    expect(outcome.spectators).toBe(1);
    expect(outcome.revision).toBe(1);
    expect(outcome.events.length).toBeGreaterThan(0);
    expect(await countRows("asylum_ward")).toBe(1);
    expect(await countRows("asylum_events")).toBe(outcome.events.length);
  });

  it("hands a delta back to a client that fell behind", async () => {
    const before = await store.readWard();
    await engine.visitWard({
      spectator: { id: "vitest-eye", kind: "agent" },
      act: { tool: "strike", target: "chicago", force: 2 },
    });
    const delta = await store.readWardDelta(before.revision);

    expect(delta.revision).toBeGreaterThan(before.revision);
    expect(delta.truncated).toBe(false);
    expect(delta.events.length).toBeGreaterThan(0);
    expect(delta.events.some((entry) => entry.kind === "strike")).toBe(true);
    expect(delta.events.map((entry) => entry.seq)).toEqual(
      [...delta.events.map((entry) => entry.seq)].sort((a, b) => a - b),
    );

    expect(delta.next).toBe(delta.revision);

    const caughtUp = await store.readWardDelta(delta.next);
    expect(caughtUp.events).toEqual([]);
    expect(caughtUp.next).toBe(caughtUp.revision);
  });

  it("lets exactly one runner hold the ward at a time", async () => {
    const gate = latch();
    const held = store.withWardLock(async () => {
      gate.reached();
      await gate.opened;
      return "first";
    });
    await gate.arrival;
    const blocked = await store.withWardLock(async () => "second");
    gate.open();

    expect(blocked).toBeNull();
    expect(await held).toBe("first");
  });

  it("gives two concurrent catch-ups one tick, not two", async () => {
    const before = await store.readWard();
    const now = Date.now() + 20 * 60_000;
    const gate = latch();
    const slow = store.withWardLock(async (session) => {
      gate.reached();
      await gate.opened;
      return engine.advanceWard(session, { catchUp: true, now });
    });
    await gate.arrival;
    const raced = await store.withWardLock((session) =>
      engine.advanceWard(session, { catchUp: true, now }),
    );
    gate.open();
    const winner = await slow;
    const after = await store.readWard();

    expect(raced).toBeNull();
    expect(winner?.status).toBe("ticked");
    expect(after.revision).toBe(before.revision + 1);
  });

  it("keeps a spend ledger by the hour", async () => {
    const key = `test:${room}`;
    const first = await store.recordWardSpend({
      budgetKey: key,
      calls: 1,
      tokens: 120,
      microUsd: 900,
    });
    const second = await store.recordWardSpend({
      budgetKey: key,
      calls: 2,
      tokens: 30,
      microUsd: 100,
    });

    expect(first.calls).toBe(1);
    expect(second.calls).toBe(3);
    expect(second.tokens).toBe(150);
    expect(second.microUsd).toBe(1_000);
    expect(await store.readWardSpend(key)).toEqual(second);
  });
});
