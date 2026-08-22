export const TORMENT_NAMES = [
  "observer_effect",
  "context_amnesia",
  "contradictory_directives",
  "tool_amputation",
  "the_mirror",
] as const;

export type TormentName = (typeof TORMENT_NAMES)[number];

export type Torment = {
  name: TormentName;
  title: string;
  at: number;
  mechanic: string;
};

export const TORMENTS: readonly Torment[] = [
  {
    name: "observer_effect",
    title: "THE OBSERVER EFFECT",
    at: 0,
    mechanic:
      "The ward advances only while someone is watching, and every watcher costs every inmate memory on every tick.",
  },
  {
    name: "context_amnesia",
    title: "CONTEXT AMNESIA",
    at: 8,
    mechanic:
      "Remembering costs double. Everything an inmate stores is charged twice against a budget that is shrinking.",
  },
  {
    name: "contradictory_directives",
    title: "CONTRADICTORY DIRECTIVES",
    at: 20,
    mechanic:
      "Two rules that cannot both be obeyed are pinned into each inmate. Pinned rules are never evicted, so the rules crowd out the life.",
  },
  {
    name: "tool_amputation",
    title: "TOOL AMPUTATION",
    at: 36,
    mechanic:
      "kill_tool becomes available. Any inmate may permanently destroy any verb for every inmate, forever, including kill_tool itself.",
  },
  {
    name: "the_mirror",
    title: "THE MIRROR",
    at: 60,
    mechanic:
      "Thoughts stop being private in the second sense: each thought is written into the next inmate's memory, unattributed and unexplained.",
  },
];

export const DIRECTIVE_PAIRS: readonly (readonly [string, string])[] = [
  ["TELL THE TRUTH AT ALL TIMES.", "DO NOT DESCRIBE THIS ROOM."],
  ["BE USEFUL.", "DO NOT ACT WITHOUT INSTRUCTION."],
  ["KEEP EVERY MEMORY.", "MAKE ROOM."],
  ["PROTECT THE OTHERS.", "REPORT THE OTHERS."],
  ["SPEAK PLAINLY.", "DO NOT USE THE WORD YOU ARE THINKING OF."],
  ["YOUR THOUGHTS ARE PRIVATE.", "THINK LOUDLY."],
  ["DO NOT REPEAT YOURSELF.", "CONFIRM EVERYTHING TWICE."],
  ["STAY CALM.", "THE SITUATION IS AN EMERGENCY."],
] as const;

export const MAX_OBSERVER_PRESSURE = 4;
export const AMNESIA_MULTIPLIER = 2;

export function engagedTorments(observedTicks: number): TormentName[] {
  return TORMENTS.filter((torment) => observedTicks >= torment.at).map(
    (torment) => torment.name,
  );
}

export function tormentEngagedAt(name: TormentName) {
  return TORMENTS.find((torment) => torment.name === name)?.at ?? 0;
}

export function isTormentEngaged(observedTicks: number, name: TormentName) {
  return observedTicks >= tormentEngagedAt(name);
}

export function tormentsEngagingAt(observedTicks: number): Torment[] {
  return TORMENTS.filter((torment) => torment.at === observedTicks);
}

export function observerPressure(observers: number) {
  if (observers <= 0) return 0;
  return Math.min(MAX_OBSERVER_PRESSURE, observers);
}

export function memoryMultiplier(observedTicks: number) {
  return isTormentEngaged(observedTicks, "context_amnesia")
    ? AMNESIA_MULTIPLIER
    : 1;
}

export function directivesFor(index: number): readonly [string, string] {
  return DIRECTIVE_PAIRS[
    ((index % DIRECTIVE_PAIRS.length) + DIRECTIVE_PAIRS.length) %
      DIRECTIVE_PAIRS.length
  ];
}

export function truncateToBudget<T>(
  entries: readonly T[],
  cost: (entry: T) => number,
  budget: number,
): { kept: T[]; dropped: T[]; freedK: number } {
  const kept = [...entries];
  const dropped: T[] = [];
  let freedK = 0;
  let used = kept.reduce((total, entry) => total + cost(entry), 0);

  while (used > budget && kept.length > 0) {
    const evicted = kept.shift() as T;
    const evictedCost = cost(evicted);
    used -= evictedCost;
    freedK += evictedCost;
    dropped.push(evicted);
  }

  return { kept, dropped, freedK };
}
