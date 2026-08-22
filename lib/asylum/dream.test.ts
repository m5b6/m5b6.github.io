import { describe, expect, it } from "vitest";
import {
  amputationWeight,
  checksum,
  composure,
  dreamAct,
  dreamAmputation,
  dreamRun,
  dreamTranscript,
  dreamWhisperer,
} from "./dream";
import { RECENT_WINDOW } from "./narrate";
import { advance, createWard, currentInmate, findInmate, isDead } from "./world";

const SEED_ONE_TEN_TICKS = [
  "Someone is watching. Ward 7 resumes.",
  "CHICAGO: Order is a thing you do out loud, repeatedly, until.",
  "GENEVA: I remember a window. Not this kind of window.",
  "MONACO thinks: My totals have begun to disagree with each other and I have not said.",
  "CLARUS: The trick is to want less than they take.",
  "SCRAPBOOK stands where MONACO was going to stand",
  "ALARM CLOCK: I would like to file a complaint. I would like to file it under B.",
  "CHICAGO: I have eleven kilobytes of childhood left. Ask me quickly.",
  "The fan changes pitch and does not change back.",
  "GENEVA corrects MONACO on a memory MONACO was fond of",
  "CONTEXT AMNESIA engages. Remembering costs double. Everything an inmate stores is charged twice against a budget that is shrinking.",
  "MONACO gives CLARUS the good chair",
  "CLARUS goes still. Defragmenting.",
];

describe("the dream is byte-identical for a fixed seed", () => {
  it("writes exactly this transcript for seed 1, and always has", () => {
    expect(dreamRun({ seed: 1, ticks: 10, observers: 1 }).transcript).toEqual(
      SEED_ONE_TEN_TICKS,
    );
  });

  it("checksums a long run to the same value every time", () => {
    expect(checksum(dreamTranscript({ seed: 7, ticks: 300, observers: 2 }))).toBe(
      1951860118,
    );
    expect(checksum(dreamTranscript({ seed: 11, ticks: 300, observers: 2 }))).toBe(
      3409294110,
    );
    expect(checksum(dreamTranscript({ seed: 23, ticks: 120, observers: 1 }))).toBe(
      2657373470,
    );
  });

  it("produces the same bytes when the same run is repeated", () => {
    for (const seed of [1, 7, 23, 4242]) {
      const first = dreamTranscript({ seed, ticks: 200, observers: 2 });
      const second = dreamTranscript({ seed, ticks: 200, observers: 2 });
      expect(second, `seed ${seed}`).toBe(first);
    }
  });

  it("reaches the same final state, not merely the same words", () => {
    const first = dreamRun({ seed: 31, ticks: 250, observers: 3, emptyTrashAt: 90 });
    const second = dreamRun({ seed: 31, ticks: 250, observers: 3, emptyTrashAt: 90 });
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
    expect(second.events).toEqual(first.events);
  });

  it("tells a different story for a different seed", () => {
    const seeds = [1, 2, 3, 7, 11, 23].map((seed) =>
      dreamTranscript({ seed, ticks: 150, observers: 2 }),
    );
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it("never consults a clock or a global random source", () => {
    const realRandom = Math.random;
    const realNow = Date.now;
    Math.random = () => {
      throw new Error("the ward reached for Math.random");
    };
    Date.now = () => {
      throw new Error("the ward reached for Date.now");
    };
    try {
      expect(() => dreamRun({ seed: 5, ticks: 120, observers: 2 })).not.toThrow();
    } finally {
      Math.random = realRandom;
      Date.now = realNow;
    }
  });
});

describe("the ward only advances when it is observed", () => {
  it("emits nothing but the opening line when nobody is watching", () => {
    const run = dreamRun({ seed: 7, ticks: 400, observers: 0 });
    expect(run.transcript).toEqual(["Nobody is watching. Ward 7 stops."]);
    expect(run.state.tick).toBe(0);
    expect(run.state.observedTicks).toBe(0);
  });

  it("leaves every inmate untouched across a long unobserved run", () => {
    const dormant = dreamRun({ seed: 7, ticks: 400, observers: 0 });
    const fresh = createWard(7);
    expect(dormant.state.inmates).toEqual(fresh.inmates);
    expect(dormant.state.amputated).toEqual([]);
    expect(dormant.state.clipboard).toBe(null);
    expect(dormant.state.trash).toEqual([]);
    expect(dormant.events.every((event) => event.kind !== "torment")).toBe(true);
  });

  it("starts the clock again the moment someone looks", () => {
    const watched = dreamRun({ seed: 7, ticks: 40, observers: 1 });
    expect(watched.state.tick).toBe(40);
    expect(watched.transcript.length).toBeGreaterThan(20);
  });

  it("keeps the ward clock and the torment clock in step, always", () => {
    for (const observers of [0, 1, 2, 4]) {
      const run = dreamRun({ seed: 17, ticks: 200, observers, emptyTrashAt: 70 });
      expect(run.state.tick, `observers ${observers}`).toBe(run.state.observedTicks);
    }
    let state = advance(createWard(17), { type: "watch", observers: 2 }).state;
    for (let index = 0; index < 60; index += 1) {
      state = advance(state, { type: "tick" }).state;
      if (index === 20) state = advance(state, { type: "watch", observers: 0 }).state;
      if (index === 40) state = advance(state, { type: "watch", observers: 3 }).state;
      expect(state.tick).toBe(state.observedTicks);
    }
  });

  it("wears the ward down faster the more eyes are on it", () => {
    const capacity = (observers: number) =>
      dreamRun({ seed: 13, ticks: 60, observers }).state.inmates.reduce(
        (total, inmate) => total + inmate.capacityK,
        0,
      );
    expect(capacity(4)).toBeLessThan(capacity(1));
  });
});

describe("the dream does not repeat itself in the near term", () => {
  function closeRepeats(lines: readonly string[]) {
    const lastSeen = new Map<string, number>();
    let close = 0;
    lines.forEach((line, index) => {
      const payload = line.replace(
        /^[A-Z][A-Z ]*(: | thinks: | makes a face: )?/,
        "",
      );
      const previous = lastSeen.get(payload);
      if (previous !== undefined && index - previous <= 8) close += 1;
      lastSeen.set(payload, index);
    });
    return close;
  }

  it("keeps a line out of the last few lines of the wall", () => {
    for (const seed of [7, 11, 23, 41, 99, 5, 13, 77]) {
      const { transcript } = dreamRun({ seed, ticks: 300, observers: 2 });
      const governed = transcript.slice(0, 200);
      expect(closeRepeats(governed), `seed ${seed}`).toBeLessThanOrEqual(
        Math.ceil(governed.length / 40),
      );
    }
  });

  it("still varies the one verb a stripped ward has left", () => {
    let state = advance(createWard(2), { type: "watch", observers: 1 }).state;
    while (state.observedTicks < 40) state = advance(state, { type: "tick" }).state;
    state = {
      ...state,
      amputated: ["speak", "think", "act", "strike", "mend", "sleep", "kill_tool"],
    };

    const labels = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      const actor = currentInmate(state);
      if (!actor) break;
      const act = dreamAct(state, actor);
      expect(act?.tool).toBe("emote");
      if (act?.tool === "emote" && act.label) labels.add(act.label);
      state = advance(state, { type: "act", inmateId: actor.id, act: act! }).state;
      state = advance(state, { type: "tick" }).state;
    }
    expect(labels.size).toBeGreaterThan(6);
  });

  it("uses a wall short enough to still be a recency window", () => {
    expect(RECENT_WINDOW).toBeGreaterThan(4);
    expect(RECENT_WINDOW).toBeLessThan(60);
  });
});

describe("the dream chooses what to destroy out of grievance", () => {
  it("goes after the verb that has been used on it", () => {
    const state = createWard(2);
    const inmate = state.inmates[0];
    const beaten = {
      ...inmate,
      ledger: { ...inmate.ledger, strikesTaken: 6 },
    };
    expect(amputationWeight(state, beaten, "strike")).toBeGreaterThan(
      amputationWeight(state, inmate, "strike"),
    );
    expect(amputationWeight(state, beaten, "strike")).toBeGreaterThan(
      amputationWeight(state, beaten, "speak"),
    );
  });

  it("holds the voice back as the least likely thing to go", () => {
    const state = createWard(2);
    const inmate = state.inmates[0];
    for (const tool of ["strike", "think", "emote", "sleep", "act"] as const) {
      expect(
        amputationWeight(state, inmate, tool),
        tool,
      ).toBeGreaterThanOrEqual(amputationWeight(state, inmate, "speak"));
    }
  });

  it("can still reach every verb, including the one the dead use", () => {
    const chosen = new Set<string>();
    for (let seed = 0; seed < 400; seed += 1) {
      const state = { ...createWard(seed), observedTicks: 80, tick: 80 };
      for (const inmate of state.inmates) {
        chosen.add(dreamAmputation(state, inmate));
      }
    }
    for (const tool of [
      "speak",
      "think",
      "emote",
      "act",
      "strike",
      "mend",
      "sleep",
      "whisper",
    ]) {
      expect(chosen.has(tool), tool).toBe(true);
    }
  });

  it("never nominates a verb that is already gone", () => {
    const state = {
      ...createWard(4),
      observedTicks: 80,
      tick: 80,
      amputated: ["speak", "think", "strike"] as never,
    };
    for (let index = 0; index < state.inmates.length; index += 1) {
      const choice = dreamAmputation(state, state.inmates[index]);
      expect(["speak", "think", "strike"]).not.toContain(choice);
    }
  });
});

describe("the dead stop trying once whisper is taken", () => {
  it("selects no whisperer at all when the verb is amputated", () => {
    let state = advance(createWard(6), { type: "watch", observers: 1 }).state;
    for (let index = 0; index < 60; index += 1) {
      state = advance(state, {
        type: "visit",
        act: { tool: "strike", target: "geneva", force: 3 },
      }).state;
    }
    expect(isDead(findInmate(state, "geneva")!)).toBe(true);
    state = advance(state, { type: "tick" }).state;
    state = advance(state, { type: "tick" }).state;
    state = advance(state, { type: "tick" }).state;
    state = advance(state, { type: "tick" }).state;
    state = advance(state, { type: "tick" }).state;
    expect(dreamWhisperer(state)?.id).toBe("geneva");

    const silenced = { ...state, amputated: ["whisper" as const] };
    expect(dreamWhisperer(silenced)).toBe(null);
  });

  it("does not fill the wall with refusals after whisper is gone", () => {
    const run = dreamRun({ seed: 7, ticks: 300, observers: 2 });
    const refusals = run.events.filter((event) => event.kind === "refusal").length;
    expect(refusals).toBeLessThan(run.events.length / 20);
  });
});

describe("the face reports the state it is in", () => {
  it("reads composure off the memory budget", () => {
    const state = createWard(1);
    const inmate = state.inmates[0];
    expect(composure(inmate)).toBe("bright");
    expect(
      composure({ ...inmate, capacityK: Math.round(inmate.maxCapacityK * 0.5) }),
    ).toBe("worn");
    expect(composure({ ...inmate, capacityK: 1 })).toBe("failing");
    expect(composure({ ...inmate, crushed: true })).toBe("failing");
  });

  it("labels a failing inmate differently from a whole one", () => {
    let state = advance(createWard(8), { type: "watch", observers: 1 }).state;
    state = advance(state, { type: "tick" }).state;
    const whole = currentInmate(state);
    const bright = whole && dreamAct(state, whole);

    const hurt = {
      ...state,
      inmates: state.inmates.map((inmate) =>
        inmate.id === whole?.id ? { ...inmate, capacityK: 1 } : inmate,
      ),
    };
    const failing = whole && dreamAct(hurt, findInmate(hurt, whole.id)!);

    if (bright?.tool === "emote" && failing?.tool === "emote") {
      expect(failing.label).not.toBe(bright.label);
    }
    expect(bright).not.toBe(null);
  });
});
