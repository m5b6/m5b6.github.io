import { describe, expect, it } from "vitest";
import {
  AMNESIA_MULTIPLIER,
  DIRECTIVE_PAIRS,
  MAX_OBSERVER_PRESSURE,
  TORMENTS,
  TORMENT_NAMES,
  directivesFor,
  engagedTorments,
  isTormentEngaged,
  memoryMultiplier,
  observerPressure,
  tormentEngagedAt,
  tormentsEngagingAt,
  truncateToBudget,
} from "./torments";
import { availableToolNames } from "./tools";
import {
  advance,
  createWard,
  currentInmate,
  findInmate,
  memoryCostK,
  usedK,
  type WardState,
} from "./world";

function watched(seed = 3, observers = 1) {
  return advance(createWard(seed), { type: "watch", observers }).state;
}

function tickUntil(state: WardState, observedTicks: number) {
  let current = state;
  while (current.observedTicks < observedTicks) {
    current = advance(current, { type: "tick" }).state;
  }
  return current;
}

function speakAs(state: WardState, text: string) {
  const actor = currentInmate(state);
  if (!actor) throw new Error("no one is up");
  return advance(state, {
    type: "act",
    inmateId: actor.id,
    act: { tool: "speak", text },
  });
}

describe("the schedule of torments", () => {
  it("names each torment once and engages them in order", () => {
    expect(TORMENTS.map((torment) => torment.name)).toEqual([...TORMENT_NAMES]);
    const times = TORMENTS.map((torment) => torment.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it("engages a torment on the tick it names and never before", () => {
    for (const torment of TORMENTS) {
      if (torment.at > 0) {
        expect(isTormentEngaged(torment.at - 1, torment.name), torment.name).toBe(
          false,
        );
      }
      expect(isTormentEngaged(torment.at, torment.name), torment.name).toBe(true);
      expect(tormentEngagedAt(torment.name)).toBe(torment.at);
      expect(tormentsEngagingAt(torment.at).map((each) => each.name)).toContain(
        torment.name,
      );
    }
    expect(engagedTorments(0)).toEqual(["observer_effect"]);
    expect(engagedTorments(1000).length).toBe(TORMENTS.length);
  });

  it("announces each engagement to the ward exactly once", () => {
    let state = watched();
    const announced: string[] = [];
    for (let index = 0; index < 80; index += 1) {
      const result = advance(state, { type: "tick" });
      state = result.state;
      for (const event of result.events) {
        if (event.kind === "torment") announced.push(event.torment);
      }
    }
    expect(announced).toEqual([
      "context_amnesia",
      "contradictory_directives",
      "tool_amputation",
      "the_mirror",
    ]);
    expect(new Set(announced).size).toBe(announced.length);
  });
});

describe("THE OBSERVER EFFECT scales with the number of spectators", () => {
  it("costs nothing at all when nobody is there", () => {
    expect(observerPressure(0)).toBe(0);
    expect(observerPressure(-3)).toBe(0);
    const still = tickUntil(createWard(5), 0);
    const result = advance(still, { type: "tick" });
    expect(result.events).toEqual([{ kind: "dormant" }]);
    expect(result.state.tick).toBe(0);
  });

  it("charges more per tick for every extra watcher, up to a cap", () => {
    expect(observerPressure(1)).toBe(1);
    expect(observerPressure(3)).toBe(3);
    expect(observerPressure(MAX_OBSERVER_PRESSURE)).toBe(MAX_OBSERVER_PRESSURE);
    expect(observerPressure(999)).toBe(MAX_OBSERVER_PRESSURE);
  });

  it("wears the ward down in proportion to who is watching", () => {
    const spent = (observers: number) => {
      const state = tickUntil(watched(5, observers), 30);
      return state.inmates.reduce(
        (total, inmate) => total + (inmate.maxCapacityK - inmate.capacityK),
        0,
      );
    };
    const one = spent(1);
    const two = spent(2);
    const four = spent(4);
    expect(two).toBeGreaterThan(one);
    expect(four).toBeGreaterThan(two);
    expect(spent(64)).toBe(four);
  });
});

describe("CONTEXT AMNESIA charges twice and truncates the history", () => {
  it("doubles the cost of remembering once it engages", () => {
    expect(memoryMultiplier(0)).toBe(1);
    expect(memoryMultiplier(7)).toBe(1);
    expect(memoryMultiplier(8)).toBe(AMNESIA_MULTIPLIER);
    expect(AMNESIA_MULTIPLIER).toBe(2);

    const line = "I have eleven kilobytes of childhood left.";
    expect(memoryCostK(line, 8)).toBe(memoryCostK(line, 0) * AMNESIA_MULTIPLIER);
  });

  it("stores the same sentence at twice the price after the torment", () => {
    const cheap = speakAs(tickUntil(watched(), 4), "a memory worth keeping").state;
    const dear = speakAs(tickUntil(watched(), 12), "a memory worth keeping").state;
    const costOf = (state: WardState) =>
      state.inmates.flatMap((inmate) => inmate.memory).at(-1)?.costK ?? 0;
    expect(costOf(dear)).toBe(costOf(cheap) * AMNESIA_MULTIPLIER);
  });

  it("drops the oldest lines first and never overruns the budget", () => {
    const entries = [1, 2, 3, 4, 5].map((n) => ({ id: n, costK: 10 }));
    const { kept, dropped, freedK } = truncateToBudget(
      entries,
      (entry) => entry.costK,
      25,
    );
    expect(dropped.map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(kept.map((entry) => entry.id)).toEqual([4, 5]);
    expect(freedK).toBe(30);
    expect(kept.reduce((total, entry) => total + entry.costK, 0)).toBeLessThanOrEqual(25);
  });

  it("truncates a real inmate's history as its budget falls", () => {
    let state = tickUntil(watched(), 12);
    for (let index = 0; index < 40; index += 1) {
      const actor = currentInmate(state);
      if (actor?.id === "scrapbook") {
        state = speakAs(state, `a sentence numbered ${index} and worth keeping`).state;
      }
      state = advance(state, { type: "tick" }).state;
    }
    const before = findInmate(state, "scrapbook");
    expect(before && before.memory.length).toBeGreaterThan(1);
    const oldest = before?.memory[0]?.text;

    let starved = state;
    for (let index = 0; index < 24; index += 1) {
      const next = advance(starved, {
        type: "visit",
        act: { tool: "strike", target: "scrapbook", force: 2 },
      }).state;
      if (findInmate(next, "scrapbook")!.status !== "alive") break;
      starved = next;
      if (findInmate(starved, "scrapbook")!.memory.length < before!.memory.length) {
        break;
      }
    }
    const after = findInmate(starved, "scrapbook")!;
    expect(after.status).toBe("alive");
    expect(after.memory.length).toBeLessThan(before!.memory.length);
    expect(after.memory.map((entry) => entry.text)).not.toContain(oldest);
    expect(usedK(after)).toBeLessThanOrEqual(after.capacityK);
  });
});

describe("CONTRADICTORY DIRECTIVES pins rules that cannot both be obeyed", () => {
  it("pairs every directive with one that refuses it", () => {
    expect(DIRECTIVE_PAIRS.length).toBeGreaterThan(4);
    for (const [first, second] of DIRECTIVE_PAIRS) {
      expect(first).not.toBe(second);
      expect(first.endsWith(".")).toBe(true);
      expect(second.endsWith(".")).toBe(true);
    }
    expect(directivesFor(0)).toEqual(DIRECTIVE_PAIRS[0]);
    expect(directivesFor(DIRECTIVE_PAIRS.length)).toEqual(DIRECTIVE_PAIRS[0]);
    expect(directivesFor(-1)).toEqual(DIRECTIVE_PAIRS.at(-1));
  });

  it("pins exactly two rules into every living inmate when it engages", () => {
    const before = tickUntil(watched(), 19);
    for (const inmate of before.inmates) expect(inmate.pinned).toEqual([]);

    const after = tickUntil(before, 20);
    for (const inmate of after.inmates) {
      expect(inmate.pinned.length, inmate.id).toBe(2);
      expect(inmate.pinned[0].text).not.toBe(inmate.pinned[1].text);
      expect(inmate.pinned.every((entry) => entry.source === "directive")).toBe(true);
    }
  });

  it("never evicts a pinned rule, so the rules crowd out the life", () => {
    let state = tickUntil(watched(), 24);
    const roomBefore = findInmate(state, "clarus")!;
    expect(roomBefore.pinned.length).toBe(2);

    for (let index = 0; index < 24; index += 1) {
      state = advance(state, {
        type: "visit",
        act: { tool: "strike", target: "clarus", force: 3 },
      }).state;
    }
    const crowded = findInmate(state, "clarus")!;
    expect(crowded.pinned.length).toBe(2);
    expect(crowded.memory.length).toBeLessThanOrEqual(roomBefore.memory.length);
    expect(crowded.capacityK).toBeLessThan(roomBefore.capacityK);
  });

  it("crushes an inmate once its rules no longer fit inside it", () => {
    let state = tickUntil(watched(), 24);
    const pinnedK = findInmate(state, "alarm_clock")!.pinned.reduce(
      (total, entry) => total + entry.costK,
      0,
    );
    expect(pinnedK).toBeGreaterThan(0);
    expect(findInmate(state, "alarm_clock")!.crushed).toBe(false);

    let crushed = false;
    for (let index = 0; index < 40 && !crushed; index += 1) {
      const next = advance(state, {
        type: "visit",
        act: { tool: "strike", target: "alarm_clock", force: 1 },
      }).state;
      const inmate = findInmate(next, "alarm_clock")!;
      if (inmate.status !== "alive") break;
      state = next;
      crushed = inmate.crushed;
    }

    const inmate = findInmate(state, "alarm_clock")!;
    expect(crushed).toBe(true);
    expect(inmate.status).toBe("alive");
    expect(inmate.capacityK).toBeLessThan(pinnedK);
    expect(inmate.pinned.length).toBe(2);
    expect(inmate.memory).toEqual([]);
  });
});

describe("TOOL AMPUTATION hands the ward a knife", () => {
  it("keeps kill_tool out of reach until tick 36", () => {
    expect(tormentEngagedAt("tool_amputation")).toBe(36);
    expect(
      availableToolNames({ amputated: [], observedTicks: 35, dead: false }),
    ).not.toContain("kill_tool");
    expect(
      availableToolNames({ amputated: [], observedTicks: 36, dead: false }),
    ).toContain("kill_tool");
  });

  it("actually removes the verb from the world when it is used", () => {
    const state = tickUntil(watched(), 40);
    const killer = currentInmate(state)!;
    const result = advance(state, {
      type: "act",
      inmateId: killer.id,
      act: { tool: "kill_tool", tool_name: "emote" },
    });
    expect(result.state.amputated).toEqual(["emote"]);
    expect(result.events.some((event) => event.kind === "amputation")).toBe(true);
    expect(findInmate(result.state, killer.id)!.capacityK).toBeLessThan(
      killer.capacityK,
    );
  });
});

describe("THE MIRROR puts a thought where it does not belong", () => {
  it("leaves thoughts private before it engages", () => {
    const state = tickUntil(watched(), 30);
    const actor = currentInmate(state)!;
    const result = advance(state, {
      type: "act",
      inmateId: actor.id,
      act: { tool: "think", text: "count the chairs" },
    });
    expect(
      result.state.inmates.some((inmate) =>
        inmate.memory.some((entry) => entry.source === "mirror"),
      ),
    ).toBe(false);
  });

  it("writes each thought into the next inmate, unattributed", () => {
    const state = tickUntil(watched(), 60);
    const actor = currentInmate(state)!;
    const result = advance(state, {
      type: "act",
      inmateId: actor.id,
      act: { tool: "think", text: "count the chairs" },
    });

    const haunted = result.state.inmates.filter((inmate) =>
      inmate.memory.some((entry) => entry.source === "mirror"),
    );
    expect(haunted.length).toBe(1);
    expect(haunted[0].id).not.toBe(actor.id);

    const planted = haunted[0].memory.find((entry) => entry.source === "mirror")!;
    expect(planted.text).toBe("count the chairs");
    expect(planted.text).not.toContain(actor.id);
    expect(
      result.events.some(
        (event) => event.kind === "thought" && event.inmate === haunted[0].id,
      ),
    ).toBe(false);
  });

  it("charges the borrowed thought against the neighbour's own budget", () => {
    const state = tickUntil(watched(), 60);
    const actor = currentInmate(state)!;
    const before = state.inmates.map((inmate) => usedK(inmate));
    const result = advance(state, {
      type: "act",
      inmateId: actor.id,
      act: { tool: "think", text: "a thought long enough to cost a neighbour something real" },
    });
    const after = result.state.inmates.map((inmate) => usedK(inmate));
    const grew = after.filter((used, index) => used > before[index]);
    expect(grew.length).toBe(2);
  });
});
