import { describe, expect, it } from "vitest";
import { ASYLUM_ROOM_ID } from "./cast";
import {
  EVENT_RETENTION_REVISIONS,
  NOTIFY_LIMIT,
  budgetKeyFor,
  notifyPayload,
  pageDelta,
  parseWardState,
  prunedBelow,
  wardRateLimits,
  wardRoomId,
  wardSeed,
  wardStateSchema,
  type StoredWardEvent,
} from "./store";
import { createWard, type WardEvent } from "./world";

describe("wardRoomId", () => {
  it("gives production the one ward and everybody else a scratch one", () => {
    expect(wardRoomId({ VERCEL_ENV: "production" })).toBe(ASYLUM_ROOM_ID);
    expect(wardRoomId({ VERCEL_ENV: "preview" })).toBe(`${ASYLUM_ROOM_ID}:preview`);
    expect(wardRoomId({})).toBe(`${ASYLUM_ROOM_ID}:development`);
  });

  it("lets an explicit room win", () => {
    expect(wardRoomId({ ASYLUM_ROOM_ID: "ward-x", VERCEL_ENV: "production" })).toBe(
      "ward-x",
    );
  });
});

describe("wardSeed", () => {
  it("is stable per room and fits a Postgres integer", () => {
    const seed = wardSeed(ASYLUM_ROOM_ID);

    expect(seed).toBe(wardSeed(ASYLUM_ROOM_ID));
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2_147_483_647);
    expect(wardSeed(`${ASYLUM_ROOM_ID}:preview`)).not.toBe(seed);
  });
});

describe("parseWardState", () => {
  it("round-trips a ward through JSON", () => {
    const state = createWard(21);
    const parsed = parseWardState(JSON.parse(JSON.stringify(state)), 21);

    expect(parsed).toEqual(state);
  });

  it("starts the ward over rather than serving a corrupt one", () => {
    expect(parseWardState({ seed: "no" }, 8)).toEqual(createWard(8));
    expect(parseWardState(null, 8)).toEqual(createWard(8));
    expect(parseWardState("<script>", 8)).toEqual(createWard(8));
  });

  it("rejects an inmate the cast never had", () => {
    const state = JSON.parse(JSON.stringify(createWard(1)));
    state.inmates[0].id = "hal";

    expect(wardStateSchema.safeParse(state).success).toBe(false);
  });
});

describe("notifyPayload", () => {
  const speech: WardEvent = { kind: "speech", inmate: "chicago", text: "GOOD MORNING" };

  it("carries the events and their wall lines", () => {
    const payload = JSON.parse(notifyPayload(9, 4, [speech]));

    expect(payload).toMatchObject({ type: "ward", revision: 9, tick: 4 });
    expect(payload.events).toHaveLength(1);
    expect(payload.lines[0]).toContain("GOOD MORNING");
  });

  it("stays inside what pg_notify will carry", () => {
    const many = Array.from({ length: 400 }, () => speech);
    const payload = notifyPayload(9, 4, many);

    expect(payload.length).toBeLessThan(NOTIFY_LIMIT);
    expect(JSON.parse(payload)).toEqual({
      type: "ward",
      revision: 9,
      tick: 4,
      truncated: true,
    });
  });
});

describe("event retention", () => {
  it("prunes on a stride, and only what is far behind", () => {
    expect(prunedBelow(15)).toBeNull();
    expect(prunedBelow(17)).toBeNull();
    expect(prunedBelow(16)).toBe(16 - EVENT_RETENTION_REVISIONS);
    expect(prunedBelow(EVENT_RETENTION_REVISIONS + 16)).toBe(16);
  });
});

describe("pageDelta", () => {
  const entry = (revision: number, seq: number): StoredWardEvent => ({
    revision,
    seq,
    tick: revision,
    kind: "ambient",
    event: { kind: "ambient", text: "the ward hums" },
    line: "the ward hums",
  });

  it("points a caught-up client at the head", () => {
    const page = pageDelta([entry(4, 0), entry(5, 0)], 5, 8);

    expect(page.next).toBe(5);
    expect(page.events).toHaveLength(2);
  });

  it("never leaves half a revision behind when the page fills up", () => {
    const events = [entry(4, 0), entry(4, 1), entry(5, 0), entry(5, 1)];
    const page = pageDelta(events, 9, 4);

    expect(page.next).toBe(4);
    expect(page.events).toEqual([entry(4, 0), entry(4, 1)]);
  });

  it("still moves when one revision is larger than a whole page", () => {
    const events = [entry(4, 0), entry(4, 1)];
    const page = pageDelta(events, 9, 2);

    expect(page.next).toBe(4);
    expect(page.events).toHaveLength(2);
  });
});

describe("budgetKeyFor", () => {
  it("keys the budget to the key, never to the room, and never leaks it", () => {
    const key = "sk-or-v1-secret";

    expect(budgetKeyFor(undefined)).toBe("dream");
    expect(budgetKeyFor(key)).toBe(budgetKeyFor(key));
    expect(budgetKeyFor(key)).not.toContain(key);
    expect(budgetKeyFor(key)).not.toBe(budgetKeyFor("sk-or-v1-other"));
  });
});

describe("wardRateLimits", () => {
  it("relaxes outside production so the ward stays testable", () => {
    const previous = process.env.VERCEL_ENV;

    try {
      process.env.VERCEL_ENV = "production";
      expect(wardRateLimits()).toHaveLength(2);
      process.env.VERCEL_ENV = "preview";
      expect(wardRateLimits()[0].limit).toBeGreaterThan(100);
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });
});
