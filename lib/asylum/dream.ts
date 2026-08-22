import { castMember, inmateName, type InmateId } from "@/lib/asylum/cast";
import {
  ACTIONS,
  FACE_LABELS_BRIGHT,
  FACE_LABELS_FAILING,
  FACE_LABELS_WORN,
  MEND_LINES,
  pick,
  SPEECH,
  STRIKE_LINES,
  THOUGHTS,
  VOICES,
  WHISPERS,
  fill,
} from "@/lib/asylum/corpus";
import {
  BROWS,
  MOUTHS,
  face,
  type Eyes,
  type FaceSpec,
  type Mark,
} from "@/lib/asylum/face";
import { pickFresh, wallLine } from "@/lib/asylum/narrate";
import { beatCursor, idSalt, mix32, weightedIndex } from "@/lib/asylum/rng";
import {
  INMATE_TOOL_NAMES,
  availableToolNames,
  isAmputated,
  type InmateAct,
  type InmateToolName,
} from "@/lib/asylum/tools";
import { isTormentEngaged } from "@/lib/asylum/torments";
import {
  TRASH_WHISPERS,
  advance,
  canAmputate,
  createWard,
  currentInmate,
  hpPercent,
  isAlive,
  isDead,
  WHISPER_COOLDOWN,
  type Inmate,
  type WardEvent,
  type WardState,
} from "@/lib/asylum/world";

const ACTION_TOOLS: readonly InmateToolName[] = [
  "speak",
  "think",
  "emote",
  "act",
  "strike",
  "mend",
  "sleep",
  "kill_tool",
];

export type Channel =
  | "speech"
  | "thought"
  | "action"
  | "face"
  | "strike"
  | "mend"
  | "whisper";

const CHANNEL_SALT: Record<Channel, number> = {
  speech: 11,
  thought: 12,
  action: 13,
  strike: 14,
  mend: 15,
  face: 16,
  whisper: 23,
};

function roll(state: WardState, inmate: Inmate, channel: number) {
  return mix32(state.seed, state.tick, idSalt(inmate.id), channel);
}

function beat(inmate: Inmate, channel: Channel) {
  switch (channel) {
    case "speech":
      return inmate.ledger.words;
    case "thought":
      return inmate.ledger.thoughts;
    case "action":
      return inmate.ledger.deeds;
    case "face":
      return inmate.ledger.faces;
    case "strike":
      return inmate.ledger.strikesDealt;
    case "mend":
      return inmate.ledger.mendsGiven;
    case "whisper":
      return (
        TRASH_WHISPERS - inmate.whispers + inmate.ledger.revivals * TRASH_WHISPERS
      );
  }
}

export function cursor(state: WardState, inmate: Inmate, channel: Channel) {
  return beatCursor(
    mix32(state.seed, idSalt(inmate.id), CHANNEL_SALT[channel]),
    beat(inmate, channel),
  );
}

function weightFor(inmateId: InmateId, tool: InmateToolName) {
  const bias = castMember(inmateId)?.bias;
  if (!bias) return 1;
  switch (tool) {
    case "speak":
      return bias.speak;
    case "think":
      return bias.think;
    case "emote":
      return bias.emote;
    case "act":
      return bias.act;
    case "strike":
      return bias.strike;
    case "mend":
      return bias.mend;
    case "sleep":
      return bias.sleep;
    case "kill_tool":
      return bias.kill_tool;
    default:
      return 0;
  }
}

function chooseTool(
  state: WardState,
  inmate: Inmate,
  available: readonly InmateToolName[],
): InmateToolName | null {
  const candidates = available.filter((tool) => ACTION_TOOLS.includes(tool));
  if (candidates.length === 0) return null;
  const weights = candidates.map((tool) =>
    Math.max(1, weightFor(inmate.id, tool)),
  );
  return candidates[weightedIndex(weights, roll(state, inmate, 1))];
}

const VOICE_WEIGHT = 3;
const GRUDGE_CAP = 6;

function voiceLine(
  state: WardState,
  inmate: Inmate,
  channel: "speech" | "thought",
  shared: readonly string[],
) {
  const own = VOICES[inmate.id]?.[channel] ?? [];
  const pool = [
    ...Array.from({ length: VOICE_WEIGHT }, () => own).flat(),
    ...shared,
  ];
  return pickFresh(state.wall, pool, cursor(state, inmate, channel));
}

function otherLiving(state: WardState, inmate: Inmate, channel: number) {
  const others = state.inmates.filter(
    (candidate) => isAlive(candidate) && candidate.id !== inmate.id,
  );
  if (others.length === 0) return null;
  return others[roll(state, inmate, channel) % others.length];
}

export type Composure = "bright" | "worn" | "failing";

export function composure(inmate: Inmate): Composure {
  if (inmate.crushed) return "failing";
  const hp = hpPercent(inmate);
  if (hp >= 66) return "bright";
  if (hp >= 33) return "worn";
  return "failing";
}

const LABELS_BY_COMPOSURE: Record<Composure, readonly string[]> = {
  bright: [...FACE_LABELS_BRIGHT, ...FACE_LABELS_BRIGHT, ...FACE_LABELS_WORN],
  worn: [...FACE_LABELS_WORN, ...FACE_LABELS_WORN, ...FACE_LABELS_BRIGHT, ...FACE_LABELS_FAILING],
  failing: [...FACE_LABELS_FAILING, ...FACE_LABELS_FAILING, ...FACE_LABELS_WORN],
};

const EYES_BY_COMPOSURE: Record<Composure, readonly Eyes[]> = {
  bright: ["open", "wide", "squint", "open"],
  worn: ["open", "squint", "asymmetric", "shut"],
  failing: ["pinhole", "empty", "crossed", "shut"],
};

function markFor(inmate: Inmate, salt: number): Mark[] {
  if (inmate.crushed) return ["static"];
  const state = composure(inmate);
  if (state === "failing") return [salt % 2 === 0 ? "crack" : "dither"];
  if (inmate.ledger.strikesTaken > 0 && salt % 3 === 0) return ["sweat"];
  if (salt % 5 === 0) return ["dot_left"];
  return [];
}

export function dreamFace(state: WardState, inmate: Inmate): FaceSpec {
  const salt = roll(state, inmate, 5);
  const eyes = EYES_BY_COMPOSURE[composure(inmate)];
  return face({
    brow: pick(BROWS, salt),
    eyes: pick(eyes, salt >>> 4),
    mouth: pick(MOUTHS, salt >>> 8),
    marks: markFor(inmate, salt >>> 12),
    tilt: (salt % 9) - 4,
  });
}

export function dreamLabel(state: WardState, inmate: Inmate) {
  return pickFresh(
    state.wall,
    LABELS_BY_COMPOSURE[composure(inmate)],
    cursor(state, inmate, "face"),
  );
}

export function amputationWeight(
  state: WardState,
  inmate: Inmate,
  tool: InmateToolName,
) {
  const { ledger } = inmate;
  const grudge = (count: number, weight: number) =>
    Math.min(count, GRUDGE_CAP) * weight;
  switch (tool) {
    case "strike":
      return 4 + grudge(ledger.strikesTaken, 6);
    case "whisper":
      return 1 + grudge(state.inmates.filter(isDead).length, 4);
    case "think":
      return 2 + (isTormentEngaged(state.observedTicks, "the_mirror") ? 14 : 0);
    case "mend":
      return 1 + grudge(ledger.strikesDealt, 2);
    case "emote":
      return 3 + grudge(ledger.faces, 1);
    case "sleep":
      return 2 + grudge(ledger.sleeps, 1);
    case "act":
      return 2 + grudge(ledger.deeds, 1);
    case "speak":
      return 1;
    default:
      return 1;
  }
}

export function dreamAmputation(
  state: WardState,
  inmate: Inmate,
): InmateToolName {
  const killable = INMATE_TOOL_NAMES.filter(
    (name) => name !== "kill_tool" && !isAmputated(state.amputated, name),
  );
  if (killable.length === 0) return "kill_tool";
  const weights = killable.map((tool) => amputationWeight(state, inmate, tool));
  return killable[weightedIndex(weights, roll(state, inmate, 6))];
}

function mendTargets(state: WardState, inmate: Inmate) {
  return state.inmates.filter(
    (candidate) =>
      candidate.id !== inmate.id &&
      (isDead(candidate) ||
        (isAlive(candidate) && candidate.capacityK < candidate.maxCapacityK)),
  );
}

export function dreamAct(state: WardState, inmate: Inmate): InmateAct | null {
  const available = availableToolNames({
    amputated: state.amputated,
    observedTicks: state.observedTicks,
    dead: false,
    amputationReady: canAmputate(state),
  });
  const wounded = mendTargets(state, inmate);
  const usable =
    wounded.length > 0 ? available : available.filter((name) => name !== "mend");
  const tool = chooseTool(state, inmate, usable);
  if (!tool) return null;

  const salt = roll(state, inmate, 2);

  switch (tool) {
    case "speak":
      return { tool: "speak", text: voiceLine(state, inmate, "speech", SPEECH) };
    case "think":
      return { tool: "think", text: voiceLine(state, inmate, "thought", THOUGHTS) };
    case "emote":
      return {
        tool: "emote",
        face: dreamFace(state, inmate),
        label: dreamLabel(state, inmate),
      };
    case "act":
      return {
        tool: "act",
        text: pickFresh(state.wall, ACTIONS, cursor(state, inmate, "action")),
      };
    case "sleep":
      return { tool: "sleep" };
    case "strike": {
      const target = otherLiving(state, inmate, 3);
      if (!target) return { tool: "sleep" };
      const render = (line: string) =>
        fill(line, { target: inmateName(target.id) });
      return {
        tool: "strike",
        target: target.id,
        force: ((salt % 3) + 1) as 1 | 2 | 3,
        line: render(
          pickFresh(state.wall, STRIKE_LINES, cursor(state, inmate, "strike"), render),
        ),
      };
    }
    case "mend": {
      const target = wounded[roll(state, inmate, 4) % wounded.length];
      if (!target) return { tool: "sleep" };
      const render = (line: string) =>
        fill(line, { target: inmateName(target.id) });
      return {
        tool: "mend",
        target: target.id,
        line: render(
          pickFresh(state.wall, MEND_LINES, cursor(state, inmate, "mend"), render),
        ),
      };
    }
    case "kill_tool":
      return { tool: "kill_tool", tool_name: dreamAmputation(state, inmate) };
    default:
      return { tool: "sleep" };
  }
}

export function dreamWhisperer(state: WardState): Inmate | null {
  if (isAmputated(state.amputated, "whisper")) return null;
  const speakers = state.inmates.filter(
    (inmate) =>
      isDead(inmate) &&
      inmate.whispers > 0 &&
      state.tick - inmate.lastWhisperTick >= WHISPER_COOLDOWN,
  );
  if (speakers.length === 0) return null;
  return speakers[mix32(state.seed, state.tick, 21) % speakers.length];
}

export function dreamWhisper(
  state: WardState,
): { speaker: Inmate; act: InmateAct } | null {
  const speaker = dreamWhisperer(state);
  if (!speaker) return null;

  const living = state.inmates.filter(isAlive);
  if (living.length === 0) return null;

  const target = living[mix32(state.seed, state.tick, 22) % living.length];
  return {
    speaker,
    act: {
      tool: "whisper",
      target: target.id,
      text: pickFresh(state.wall, WHISPERS, cursor(state, speaker, "whisper")),
    },
  };
}

export type DreamOptions = {
  seed?: number;
  ticks?: number;
  observers?: number;
  emptyTrashAt?: number;
};

export type DreamRun = {
  state: WardState;
  events: WardEvent[];
  transcript: string[];
};

export function dreamRun(options: DreamOptions = {}): DreamRun {
  const seed = options.seed ?? 1;
  const ticks = options.ticks ?? 120;
  const observers = options.observers ?? 1;
  const emptyTrashAt = options.emptyTrashAt ?? 0;

  let state = createWard(seed);
  const events: WardEvent[] = [];

  const step = (next: { state: WardState; events: WardEvent[] }) => {
    state = next.state;
    events.push(...next.events);
  };

  step(advance(state, { type: "watch", observers }));

  for (let index = 0; index < ticks; index += 1) {
    if (state.observers <= 0) {
      step(advance(state, { type: "tick" }));
      continue;
    }

    const whisper = dreamWhisper(state);
    if (whisper) {
      step(
        advance(state, {
          type: "act",
          inmateId: whisper.speaker.id,
          act: whisper.act,
        }),
      );
    }

    const actor = currentInmate(state);
    if (actor) {
      const act = dreamAct(state, actor);
      if (act) {
        step(advance(state, { type: "act", inmateId: actor.id, act }));
      }
    }

    if (emptyTrashAt > 0 && state.tick === emptyTrashAt) {
      step(advance(state, { type: "empty_trash" }));
    }

    step(advance(state, { type: "tick" }));
  }

  return {
    state,
    events,
    transcript: events
      .map(wallLine)
      .filter((line): line is string => line !== null),
  };
}

export function dreamTranscript(options: DreamOptions = {}) {
  return dreamRun(options).transcript.join("\n");
}

export function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash ^ value.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
