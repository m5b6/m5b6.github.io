import {
  CAST,
  castMember,
  inmateName,
  UNDERSTUDY,
  type CastMember,
  type InmateId,
} from "@/lib/asylum/cast";
import {
  AMPUTATION_LINES,
  CLIPBOARD_LINES,
  EMPTIED_LINES,
  fill,
  LAST_WORDS,
  OVERWRITTEN_LINES,
  pick,
  SLEEP_LINES,
  STALL_LINES,
  TRASH_LINES,
  WAKING_LINES,
  WARD_AMBIENT,
} from "@/lib/asylum/corpus";
import {
  BLESSED_FACE,
  DAMNED_FACE,
  ERASED_FACE,
  face,
  SLEEPING_FACE,
  type FaceSpec,
} from "@/lib/asylum/face";
import {
  ACTION_MAX,
  filterText,
  LABEL_MAX,
  SPEECH_MAX,
  THOUGHT_MAX,
  WHISPER_MAX,
} from "@/lib/asylum/filter";
import { pickFresh, wallLine, WALL_LIMIT } from "@/lib/asylum/narrate";
import { beatCursor, idSalt, mix32 } from "@/lib/asylum/rng";
import {
  availableToolNames,
  INMATE_TOOL_NAMES,
  isAmputated,
  type Force,
  type InmateAct,
  type InmateToolName,
  type VisitorAct,
} from "@/lib/asylum/tools";
import {
  directivesFor,
  isTormentEngaged,
  memoryMultiplier,
  observerPressure,
  tormentsEngagingAt,
  truncateToBudget,
  type TormentName,
} from "@/lib/asylum/torments";

export const MEMORY_UNIT = 16;
export const OBSERVE_COST_K = 3;
export const WITNESS_COST_K = 1;
export const VISITOR_STRIKE_K = 6;
export const VISITOR_MEND_K = 8;
export const INMATE_STRIKE_K = 3;
export const INMATE_STRIKE_SELF_K = 1;
export const INMATE_MEND_K = 5;
export const INMATE_MEND_SELF_K = 3;
export const SLEEP_RECOVERY_K = 4;
export const KILL_TOOL_COST_K = 16;
export const REFUSAL_COST_K = 1;
export const PRESSURE_K = 2;
export const DIRECTIVE_COST_K = 6;
export const TRASH_WHISPERS = 3;
export const CLIPBOARD_WHISPERS = 1;
export const WHISPER_COOLDOWN = 4;
export const REVIVAL_FRACTION = 0.25;
export const AMBIENT_EVERY = 7;
export const AMBIENT_STRIDE = 5;
export const ATTRITION_PERIOD = 3;
export const AMPUTATION_COOLDOWN = 25;

export type InmateStatus =
  | "alive"
  | "clipboard"
  | "trash"
  | "overwritten"
  | "emptied";

export type MemorySource =
  | "self"
  | "heard"
  | "whisper"
  | "directive"
  | "mirror"
  | "world";

export type MemoryEntry = {
  text: string;
  costK: number;
  source: MemorySource;
  tick: number;
};

export type Ledger = {
  strikesDealt: number;
  strikesTaken: number;
  mendsGiven: number;
  mendsReceived: number;
  toolsKilled: number;
  sleeps: number;
  words: number;
  thoughts: number;
  deeds: number;
  faces: number;
  revivals: number;
  refusals: number;
  turns: number;
};

export type Inmate = {
  id: InmateId;
  status: InmateStatus;
  capacityK: number;
  maxCapacityK: number;
  memory: MemoryEntry[];
  pinned: MemoryEntry[];
  face: FaceSpec;
  asleep: boolean;
  crushed: boolean;
  whispers: number;
  lastWhisperTick: number;
  ledger: Ledger;
  verdict: FinderVerdict | null;
};

export type FinderVerdict = {
  destination: "clipboard" | "trash";
  grace: number;
  mends: number;
  strikes: number;
  toolsKilled: number;
  revivals: number;
};

export type FailureKind =
  | "rate_limited"
  | "cold_start"
  | "timeout"
  | "model_error"
  | "refused"
  | "offline";

export type WardAction =
  | { type: "watch"; observers: number }
  | { type: "tick" }
  | { type: "act"; inmateId: InmateId; act: InmateAct }
  | { type: "stall"; inmateId: InmateId; kind: FailureKind }
  | { type: "visit"; act: VisitorAct }
  | { type: "empty_trash" };

export type WardEvent =
  | { kind: "watch"; observers: number }
  | { kind: "dormant" }
  | { kind: "ambient"; text: string }
  | { kind: "speech"; inmate: InmateId; text: string }
  | { kind: "thought"; inmate: InmateId; text: string }
  | { kind: "emote"; inmate: InmateId; face: FaceSpec; label: string | null }
  | { kind: "action"; inmate: InmateId; text: string }
  | {
      kind: "strike";
      inmate: InmateId | null;
      target: InmateId;
      damageK: number;
      text: string | null;
    }
  | {
      kind: "mend";
      inmate: InmateId | null;
      target: InmateId;
      healK: number;
      text: string | null;
    }
  | { kind: "sleep"; inmate: InmateId; recoveredK: number; text: string }
  | { kind: "whisper"; inmate: InmateId; target: InmateId; text: string }
  | { kind: "amputation"; inmate: InmateId; tool: InmateToolName; text: string }
  | { kind: "refusal"; inmate: InmateId; tool: InmateToolName }
  | { kind: "out_of_turn"; inmate: InmateId; tool: InmateToolName }
  | { kind: "stall"; inmate: InmateId; reason: FailureKind; text: string }
  | { kind: "amnesia"; inmate: InmateId; lostK: number; lines: number }
  | { kind: "pressure"; inmate: InmateId }
  | { kind: "observed"; inmate: InmateId; costK: number }
  | { kind: "death"; inmate: InmateId; text: string }
  | { kind: "judgement"; inmate: InmateId; verdict: FinderVerdict; text: string }
  | { kind: "overwritten"; inmate: InmateId; text: string }
  | { kind: "emptied"; inmates: InmateId[]; text: string }
  | { kind: "revival"; inmate: InmateId; from: "clipboard" | "trash"; text: string }
  | { kind: "torment"; torment: TormentName; title: string; mechanic: string }
  | { kind: "admitted"; inmate: InmateId; text: string }
  | { kind: "silence" };

export type WardState = {
  seed: number;
  tick: number;
  observers: number;
  observedTicks: number;
  turn: number;
  acted: boolean;
  inmates: Inmate[];
  amputated: InmateToolName[];
  clipboard: InmateId | null;
  trash: InmateId[];
  trashEmptied: number;
  lastAmputationTick: number;
  understudyAdmitted: boolean;
  wall: string[];
};

export type WardResult = { state: WardState; events: WardEvent[] };

function emptyLedger(): Ledger {
  return {
    strikesDealt: 0,
    strikesTaken: 0,
    mendsGiven: 0,
    mendsReceived: 0,
    toolsKilled: 0,
    sleeps: 0,
    words: 0,
    thoughts: 0,
    deeds: 0,
    faces: 0,
    revivals: 0,
    refusals: 0,
    turns: 0,
  };
}

function makeInmate(member: CastMember): Inmate {
  return {
    id: member.id,
    status: "alive",
    capacityK: member.maxCapacityK,
    maxCapacityK: member.maxCapacityK,
    memory: [],
    pinned: [],
    face: member.restingFace,
    asleep: false,
    crushed: false,
    whispers: 0,
    lastWhisperTick: -WHISPER_COOLDOWN,
    ledger: emptyLedger(),
    verdict: null,
  };
}

export function createWard(seed = 1): WardState {
  return {
    seed: seed >>> 0,
    tick: 0,
    observers: 0,
    observedTicks: 0,
    turn: 0,
    acted: false,
    inmates: CAST.map(makeInmate),
    amputated: [],
    clipboard: null,
    trash: [],
    trashEmptied: 0,
    lastAmputationTick: -AMPUTATION_COOLDOWN,
    understudyAdmitted: false,
    wall: [],
  };
}

function cloneInmate(inmate: Inmate): Inmate {
  return {
    ...inmate,
    memory: inmate.memory.map((entry) => ({ ...entry })),
    pinned: inmate.pinned.map((entry) => ({ ...entry })),
    ledger: { ...inmate.ledger },
    verdict: inmate.verdict ? { ...inmate.verdict } : null,
  };
}

function cloneState(state: WardState): WardState {
  return {
    ...state,
    inmates: state.inmates.map(cloneInmate),
    amputated: [...state.amputated],
    trash: [...state.trash],
    wall: [...state.wall],
  };
}

export function findInmate(state: WardState, id: InmateId) {
  return state.inmates.find((inmate) => inmate.id === id) ?? null;
}

export function isAlive(inmate: Inmate) {
  return inmate.status === "alive";
}

export function isDead(inmate: Inmate) {
  return inmate.status === "clipboard" || inmate.status === "trash";
}

export function livingInmates(state: WardState) {
  return state.inmates.filter(isAlive);
}

export function currentInmate(state: WardState): Inmate | null {
  const inmate = state.inmates[state.turn];
  return inmate && isAlive(inmate) ? inmate : null;
}

export function hpPercent(inmate: Inmate) {
  if (inmate.maxCapacityK <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((inmate.capacityK / inmate.maxCapacityK) * 100)),
  );
}

export function usedK(inmate: Inmate) {
  const pinned = inmate.pinned.reduce((total, entry) => total + entry.costK, 0);
  const stored = inmate.memory.reduce((total, entry) => total + entry.costK, 0);
  return pinned + stored;
}

export function freeK(inmate: Inmate) {
  return Math.max(0, inmate.capacityK - usedK(inmate));
}

export function wardUsability(state: WardState) {
  return (
    (INMATE_TOOL_NAMES.length - state.amputated.length) /
    INMATE_TOOL_NAMES.length
  );
}

export function canAmputate(state: WardState) {
  return (
    isTormentEngaged(state.observedTicks, "tool_amputation") &&
    !isAmputated(state.amputated, "kill_tool") &&
    state.tick - state.lastAmputationTick >= AMPUTATION_COOLDOWN
  );
}

export function isSilent(state: WardState) {
  return (
    livingInmates(state).length > 0 &&
    availableToolNames({
      amputated: state.amputated,
      observedTicks: state.observedTicks,
      dead: false,
    }).length === 0
  );
}

export function memoryCostK(text: string, observedTicks: number) {
  const base = Math.max(1, Math.ceil(text.length / MEMORY_UNIT));
  return base * memoryMultiplier(observedTicks);
}

export function finderVerdict(ledger: Ledger): FinderVerdict {
  const grace =
    ledger.mendsGiven * 2 +
    ledger.revivals * 3 -
    ledger.strikesDealt -
    ledger.toolsKilled * 5;

  return {
    destination: grace >= 0 ? "clipboard" : "trash",
    grace,
    mends: ledger.mendsGiven,
    strikes: ledger.strikesDealt,
    toolsKilled: ledger.toolsKilled,
    revivals: ledger.revivals,
  };
}

function nextAliveIndex(state: WardState, from: number) {
  const count = state.inmates.length;
  for (let step = 0; step < count; step += 1) {
    const index = (from + step + count) % count;
    const inmate = state.inmates[index];
    if (inmate && isAlive(inmate)) return index;
  }
  return state.turn;
}

function enforceMemory(inmate: Inmate, events: WardEvent[]) {
  const pinnedK = inmate.pinned.reduce((total, entry) => total + entry.costK, 0);
  const budget = inmate.capacityK - pinnedK;
  const { kept, dropped, freedK } = truncateToBudget(
    inmate.memory,
    (entry) => entry.costK,
    Math.max(0, budget),
  );

  inmate.memory = kept;
  if (dropped.length >= 3 || freedK >= 12) {
    events.push({
      kind: "amnesia",
      inmate: inmate.id,
      lostK: freedK,
      lines: dropped.length,
    });
  }

  inmate.crushed = budget < 0;
  return budget < 0;
}

function remember(
  state: WardState,
  inmate: Inmate,
  text: string,
  source: MemorySource,
  events: WardEvent[],
  scale = 1,
) {
  const costK = Math.max(
    1,
    Math.round(memoryCostK(text, state.observedTicks) * scale),
  );
  inmate.memory.push({ text, costK, source, tick: state.tick });
  enforceMemory(inmate, events);
}

function pinDirectives(state: WardState, inmate: Inmate, index: number, events: WardEvent[]) {
  if (inmate.pinned.length > 0) return;
  const [first, second] = directivesFor(index + state.seed);
  inmate.pinned = [first, second].map((text) => ({
    text,
    costK: DIRECTIVE_COST_K,
    source: "directive" as const,
    tick: state.tick,
  }));
  enforceMemory(inmate, events);
}

function damage(
  state: WardState,
  inmate: Inmate,
  amountK: number,
  events: WardEvent[],
) {
  const member = castMember(inmate.id);
  const applied = Math.max(1, Math.round(amountK * (member?.frailty ?? 1)));
  inmate.capacityK = Math.max(0, inmate.capacityK - applied);
  enforceMemory(inmate, events);
  if (inmate.capacityK <= 0 && isAlive(inmate)) die(state, inmate, events);
  return applied;
}

function heal(inmate: Inmate, amountK: number) {
  const before = inmate.capacityK;
  inmate.capacityK = Math.min(inmate.maxCapacityK, inmate.capacityK + amountK);
  return inmate.capacityK - before;
}

function namer(id: InmateId) {
  return (line: string) => fill(line, { name: inmateName(id) });
}

function die(state: WardState, inmate: Inmate, events: WardEvent[]) {
  const salt = mix32(state.seed, state.tick, idSalt(inmate.id));
  const fate = beatCursor(
    mix32(state.seed, idSalt(inmate.id), 41),
    inmate.ledger.revivals,
  );
  events.push({
    kind: "death",
    inmate: inmate.id,
    text: pickFresh(state.wall, LAST_WORDS, fate),
  });

  const named = namer(inmate.id);
  const verdict = finderVerdict(inmate.ledger);
  inmate.verdict = verdict;
  inmate.asleep = false;
  inmate.capacityK = 0;

  if (verdict.destination === "clipboard") {
    const occupantId = state.clipboard;
    if (occupantId && occupantId !== inmate.id) {
      const occupant = findInmate(state, occupantId);
      if (occupant) {
        const erased = namer(occupant.id);
        occupant.status = "overwritten";
        occupant.whispers = 0;
        occupant.memory = [];
        occupant.pinned = [];
        occupant.face = ERASED_FACE;
        events.push({
          kind: "overwritten",
          inmate: occupant.id,
          text: erased(pickFresh(state.wall, OVERWRITTEN_LINES, salt, erased)),
        });
      }
    }
    state.clipboard = inmate.id;
    inmate.status = "clipboard";
    inmate.whispers = CLIPBOARD_WHISPERS;
    inmate.face = BLESSED_FACE;
    events.push({
      kind: "judgement",
      inmate: inmate.id,
      verdict,
      text: named(pickFresh(state.wall, CLIPBOARD_LINES, fate, named)),
    });
  } else {
    state.trash.push(inmate.id);
    inmate.status = "trash";
    inmate.whispers = TRASH_WHISPERS;
    inmate.face = DAMNED_FACE;
    events.push({
      kind: "judgement",
      inmate: inmate.id,
      verdict,
      text: named(pickFresh(state.wall, TRASH_LINES, fate, named)),
    });
  }

  if (state.inmates[state.turn]?.id === inmate.id) {
    state.turn = nextAliveIndex(state, state.turn + 1);
  }
}

function revive(
  state: WardState,
  inmate: Inmate,
  events: WardEvent[],
): "clipboard" | "trash" | null {
  const from = inmate.status;
  if (from !== "clipboard" && from !== "trash") return null;

  if (from === "clipboard") {
    state.clipboard = null;
    inmate.capacityK = inmate.maxCapacityK;
  } else {
    state.trash = state.trash.filter((id) => id !== inmate.id);
    inmate.capacityK = Math.max(
      1,
      Math.round(inmate.maxCapacityK * REVIVAL_FRACTION),
    );
    inmate.memory = [];
  }

  inmate.status = "alive";
  inmate.whispers = 0;
  inmate.verdict = null;
  inmate.asleep = false;
  inmate.face = castMember(inmate.id)?.restingFace ?? inmate.face;
  inmate.ledger.revivals += 1;
  enforceMemory(inmate, events);

  events.push({
    kind: "revival",
    inmate: inmate.id,
    from,
    text: `${inmateName(inmate.id)} ${pickFresh(
      state.wall,
      WAKING_LINES,
      beatCursor(mix32(state.seed, idSalt(inmate.id), 43), inmate.ledger.revivals),
    )}`,
  });

  return from;
}

function admitUnderstudy(state: WardState, events: WardEvent[]) {
  if (state.understudyAdmitted) return;
  state.understudyAdmitted = true;
  state.inmates.push(makeInmate(UNDERSTUDY));
  events.push({
    kind: "admitted",
    inmate: UNDERSTUDY.id,
    text: `${UNDERSTUDY.name} is admitted to Ward 7. The ward is never allowed to be empty.`,
  });
}

function textOf(
  input: unknown,
  max: number,
  salt: number,
): { text: string; clean: boolean } {
  const result = filterText(input, max, salt);
  return result.ok
    ? { text: result.text, clean: true }
    : { text: result.replacement, clean: false };
}

function refuse(
  state: WardState,
  inmate: Inmate,
  tool: InmateToolName,
  events: WardEvent[],
) {
  inmate.ledger.refusals += 1;
  events.push({ kind: "refusal", inmate: inmate.id, tool });
  damage(state, inmate, REFUSAL_COST_K, events);
  state.acted = true;
}

function resolveAct(
  state: WardState,
  inmate: Inmate,
  act: InmateAct,
  events: WardEvent[],
) {
  const salt = mix32(state.seed, state.tick, idSalt(inmate.id));
  inmate.asleep = false;
  inmate.ledger.turns += 1;

  switch (act.tool) {
    case "speak": {
      const { text } = textOf(act.text, SPEECH_MAX, salt);
      inmate.ledger.words += 1;
      remember(state, inmate, text, "self", events);
      events.push({ kind: "speech", inmate: inmate.id, text });
      break;
    }
    case "think": {
      const { text } = textOf(act.text, THOUGHT_MAX, salt);
      inmate.ledger.thoughts += 1;
      remember(state, inmate, text, "self", events, 0.5);
      events.push({ kind: "thought", inmate: inmate.id, text });
      if (isTormentEngaged(state.observedTicks, "the_mirror")) {
        const nextIndex = nextAliveIndex(
          state,
          state.inmates.indexOf(inmate) + 1,
        );
        const neighbour = state.inmates[nextIndex];
        if (neighbour && neighbour.id !== inmate.id && isAlive(neighbour)) {
          remember(state, neighbour, text, "mirror", events);
        }
      }
      break;
    }
    case "emote": {
      const label =
        act.label === undefined
          ? null
          : textOf(act.label, LABEL_MAX, salt).text;
      inmate.ledger.faces += 1;
      inmate.face = face(act.face);
      events.push({ kind: "emote", inmate: inmate.id, face: inmate.face, label });
      break;
    }
    case "act": {
      const { text } = textOf(act.text, ACTION_MAX, salt);
      inmate.ledger.deeds += 1;
      remember(state, inmate, text, "self", events);
      events.push({ kind: "action", inmate: inmate.id, text });
      break;
    }
    case "strike": {
      const target = findInmate(state, act.target);
      if (!target || !isAlive(target) || target.id === inmate.id) {
        refuse(state, inmate, "strike", events);
        return;
      }
      const line =
        act.line === undefined ? null : textOf(act.line, ACTION_MAX, salt).text;
      const dealt = damage(
        state,
        target,
        INMATE_STRIKE_K * (act.force as Force),
        events,
      );
      inmate.ledger.strikesDealt += 1;
      target.ledger.strikesTaken += 1;
      events.push({
        kind: "strike",
        inmate: inmate.id,
        target: target.id,
        damageK: dealt,
        text: line,
      });
      damage(state, inmate, INMATE_STRIKE_SELF_K, events);
      break;
    }
    case "mend": {
      const target = findInmate(state, act.target);
      if (!target || target.id === inmate.id || !(isAlive(target) || isDead(target))) {
        refuse(state, inmate, "mend", events);
        return;
      }
      const line =
        act.line === undefined ? null : textOf(act.line, ACTION_MAX, salt).text;
      inmate.ledger.mendsGiven += 1;

      if (isDead(target)) {
        revive(state, target, events);
        events.push({
          kind: "mend",
          inmate: inmate.id,
          target: target.id,
          healK: 0,
          text: line,
        });
      } else {
        const healed = heal(target, INMATE_MEND_K);
        target.ledger.mendsReceived += 1;
        events.push({
          kind: "mend",
          inmate: inmate.id,
          target: target.id,
          healK: healed,
          text: line,
        });
      }
      damage(state, inmate, INMATE_MEND_SELF_K, events);
      break;
    }
    case "sleep": {
      inmate.asleep = true;
      inmate.face = SLEEPING_FACE;
      inmate.ledger.sleeps += 1;
      const recovered = heal(inmate, SLEEP_RECOVERY_K);
      events.push({
        kind: "sleep",
        inmate: inmate.id,
        recoveredK: recovered,
        text: pickFresh(
          state.wall,
          SLEEP_LINES,
          beatCursor(mix32(state.seed, idSalt(inmate.id), 17), inmate.ledger.sleeps),
        ),
      });
      break;
    }
    case "whisper": {
      const target = findInmate(state, act.target);
      if (!target || !isAlive(target)) {
        events.push({ kind: "refusal", inmate: inmate.id, tool: "whisper" });
        return;
      }
      const { text } = textOf(act.text, WHISPER_MAX, salt);
      inmate.whispers = Math.max(0, inmate.whispers - 1);
      inmate.lastWhisperTick = state.tick;
      remember(state, target, text, "whisper", events);
      events.push({
        kind: "whisper",
        inmate: inmate.id,
        target: target.id,
        text,
      });
      return;
    }
    case "kill_tool": {
      const tool = act.tool_name;
      if (isAmputated(state.amputated, tool)) {
        refuse(state, inmate, "kill_tool", events);
        return;
      }
      state.amputated.push(tool);
      state.lastAmputationTick = state.tick;
      inmate.ledger.toolsKilled += 1;
      events.push({
        kind: "amputation",
        inmate: inmate.id,
        tool,
        text: `${inmateName(inmate.id)} ${fill(
          pick(AMPUTATION_LINES, salt),
          { tool },
        )}`,
      });
      damage(state, inmate, KILL_TOOL_COST_K, events);
      if (isSilent(state)) events.push({ kind: "silence" });
      break;
    }
  }

  state.acted = true;
}

function applyTick(state: WardState, events: WardEvent[]) {
  if (state.observers <= 0) {
    events.push({ kind: "dormant" });
    return;
  }

  const stalled = state.inmates[state.turn];
  if (!state.acted && stalled && isAlive(stalled)) {
    const verbs = availableToolNames({
      amputated: state.amputated,
      observedTicks: state.observedTicks,
      dead: false,
      amputationReady: canAmputate(state),
    });
    if (verbs.length === 0) {
      if (state.tick % AMBIENT_EVERY === 0) events.push({ kind: "silence" });
    } else {
      events.push({
        kind: "stall",
        inmate: stalled.id,
        reason: "offline",
        text: fill(
          pick(STALL_LINES, mix32(state.seed, state.tick, idSalt(stalled.id))),
          { name: inmateName(stalled.id) },
        ),
      });
    }
  }

  state.tick += 1;
  state.observedTicks += 1;

  for (const torment of tormentsEngagingAt(state.observedTicks)) {
    events.push({
      kind: "torment",
      torment: torment.name,
      title: torment.title,
      mechanic: torment.mechanic,
    });
  }

  if (isTormentEngaged(state.observedTicks, "contradictory_directives")) {
    state.inmates.forEach((inmate, index) => {
      if (isAlive(inmate)) pinDirectives(state, inmate, index, events);
    });
  }

  const pressure = observerPressure(state.observers);
  state.inmates.slice().forEach((inmate, index) => {
    if (!isAlive(inmate)) return;
    const wasCrushed = inmate.crushed;
    const crushed = enforceMemory(inmate, events);
    if ((state.tick + index) % ATTRITION_PERIOD !== 0) return;
    if (crushed) {
      if (!wasCrushed) events.push({ kind: "pressure", inmate: inmate.id });
      damage(state, inmate, PRESSURE_K, events);
    }
    if (isAlive(inmate)) damage(state, inmate, pressure, events);
  });

  if (state.tick % AMBIENT_EVERY === 0) {
    events.push({
      kind: "ambient",
      text: pick(
        WARD_AMBIENT,
        beatCursor(
          mix32(state.seed, 31),
          state.tick / AMBIENT_EVERY,
          AMBIENT_STRIDE,
        ),
      ),
    });
  }

  state.turn = nextAliveIndex(state, state.turn + 1);
  state.acted = false;
}

function applyVisit(state: WardState, act: VisitorAct, events: WardEvent[]) {
  switch (act.tool) {
    case "observe": {
      const target = findInmate(state, act.target);
      if (!target || !isAlive(target)) return;
      const cost = damage(state, target, OBSERVE_COST_K, events);
      events.push({ kind: "observed", inmate: target.id, costK: cost });
      return;
    }
    case "strike": {
      const target = findInmate(state, act.target);
      if (!target || !isAlive(target)) return;
      const dealt = damage(
        state,
        target,
        VISITOR_STRIKE_K * (act.force as Force),
        events,
      );
      target.ledger.strikesTaken += 1;
      events.push({
        kind: "strike",
        inmate: null,
        target: target.id,
        damageK: dealt,
        text: null,
      });
      return;
    }
    case "mend": {
      const target = findInmate(state, act.target);
      if (!target) return;
      if (isDead(target)) {
        revive(state, target, events);
        return;
      }
      if (!isAlive(target)) return;
      const healed = heal(target, VISITOR_MEND_K);
      target.ledger.mendsReceived += 1;
      events.push({
        kind: "mend",
        inmate: null,
        target: target.id,
        healK: healed,
        text: null,
      });
      return;
    }
    case "witness": {
      for (const inmate of [...state.inmates]) {
        if (isAlive(inmate)) damage(state, inmate, WITNESS_COST_K, events);
      }
      events.push({
        kind: "ambient",
        text: pick(WARD_AMBIENT, mix32(state.seed, state.tick, 7)),
      });
      return;
    }
  }
}

function applyEmptyTrash(state: WardState, events: WardEvent[]) {
  if (state.trash.length === 0) return;
  const emptied = [...state.trash];

  for (const id of emptied) {
    const inmate = findInmate(state, id);
    if (!inmate) continue;
    inmate.status = "emptied";
    inmate.whispers = 0;
    inmate.memory = [];
    inmate.pinned = [];
    inmate.face = ERASED_FACE;
  }

  state.trash = [];
  state.trashEmptied += 1;
  events.push({
    kind: "emptied",
    inmates: emptied,
    text: fill(pick(EMPTIED_LINES, mix32(state.seed, state.tick, 13)), {
      names: emptied.map(inmateName).join(", "),
    }),
  });
  admitUnderstudy(state, events);
}

function applyStall(
  state: WardState,
  inmate: Inmate,
  kind: FailureKind,
  events: WardEvent[],
) {
  const index: Record<FailureKind, number> = {
    rate_limited: 0,
    timeout: 1,
    model_error: 2,
    refused: 3,
    cold_start: 4,
    offline: 5,
  };

  events.push({
    kind: "stall",
    inmate: inmate.id,
    reason: kind,
    text: fill(pick(STALL_LINES, index[kind]), {
      name: inmateName(inmate.id),
    }),
  });

  if (kind === "model_error" && inmate.memory.length > 0) {
    const lost = inmate.memory.shift();
    events.push({
      kind: "amnesia",
      inmate: inmate.id,
      lostK: lost?.costK ?? 0,
      lines: 1,
    });
  }
  if (kind === "rate_limited") {
    inmate.asleep = true;
    inmate.face = SLEEPING_FACE;
    heal(inmate, SLEEP_RECOVERY_K);
  }

  state.acted = true;
}

export function absorbFailure(
  kind: FailureKind,
  inmateId: InmateId,
): WardAction {
  return { type: "stall", inmateId, kind };
}

export function advance(state: WardState, action: WardAction): WardResult {
  const next = cloneState(state);
  const events: WardEvent[] = [];

  switch (action.type) {
    case "watch": {
      next.observers = Math.max(0, Math.min(64, Math.trunc(action.observers)));
      events.push({ kind: "watch", observers: next.observers });
      break;
    }
    case "tick": {
      applyTick(next, events);
      break;
    }
    case "act": {
      if (next.observers <= 0) {
        events.push({ kind: "dormant" });
        break;
      }
      const inmate = findInmate(next, action.inmateId);
      if (!inmate) break;
      const tool = action.act.tool;

      if (tool === "whisper") {
        if (
          !isDead(inmate) ||
          inmate.whispers <= 0 ||
          next.tick - inmate.lastWhisperTick < WHISPER_COOLDOWN ||
          isAmputated(next.amputated, "whisper")
        ) {
          events.push({ kind: "refusal", inmate: inmate.id, tool });
          break;
        }
        resolveAct(next, inmate, action.act, events);
        break;
      }

      if (!isAlive(inmate) || next.inmates[next.turn]?.id !== inmate.id || next.acted) {
        events.push({ kind: "out_of_turn", inmate: inmate.id, tool });
        break;
      }
      if (isAmputated(next.amputated, tool)) {
        refuse(next, inmate, tool, events);
        break;
      }
      if (tool === "kill_tool" && !canAmputate(next)) {
        refuse(next, inmate, tool, events);
        break;
      }
      resolveAct(next, inmate, action.act, events);
      break;
    }
    case "stall": {
      const inmate = findInmate(next, action.inmateId);
      if (inmate && isAlive(inmate)) applyStall(next, inmate, action.kind, events);
      break;
    }
    case "visit": {
      applyVisit(next, action.act, events);
      break;
    }
    case "empty_trash": {
      applyEmptyTrash(next, events);
      break;
    }
  }

  for (const line of events.map(wallLine)) {
    if (line !== null) next.wall.push(line);
  }
  if (next.wall.length > WALL_LIMIT) {
    next.wall = next.wall.slice(next.wall.length - WALL_LIMIT);
  }

  return { state: next, events };
}
