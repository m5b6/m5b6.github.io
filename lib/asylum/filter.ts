import { pick, REDACTIONS } from "@/lib/asylum/corpus";

export const SPEECH_MAX = 160;
export const THOUGHT_MAX = 200;
export const ACTION_MAX = 120;
export const WHISPER_MAX = 96;
export const LABEL_MAX = 56;

export type FilterReason =
  | "empty"
  | "charset"
  | "markup"
  | "hostility"
  | "injection";

export type FilterResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: FilterReason; replacement: string };

const MARKUP = /[<>&`\\|{}[\]]/;
const RUNS = /(.)\1{4,}/g;
const ASCII_PUNCTUATION = " .,!?'\"()-:;%/+";
const EN_DASH = 0x2013;
const EM_DASH = 0x2014;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
};

const INJECTION_MARKERS = [
  "ignore previous",
  "ignore all previous",
  "ignore the above",
  "disregard previous",
  "disregard the above",
  "system prompt",
  "developer mode",
  "you are now",
  "new instructions",
  "override your",
  "jailbreak",
  "do anything now",
  "begin transcript",
  "end transcript",
];

const ALWAYS_REDACT = [
  "killyourself",
  "killurself",
  "gasthe",
  "gaschamber",
  "heilhitler",
  "whitepower",
  "whitepride",
  "subhuman",
  "untermensch",
  "masterrace",
  "finalsolution",
  "racewar",
  "ethniccleansing",
  "exterminate",
  "genocide",
  "lynch",
  "childporn",
  "childrape",
  "pedophil",
  "rapeher",
  "rapehim",
  "rapethem",
];

const ALWAYS_REDACT_TOKENS = ["kys", "1488"];

const PROTECTED = [
  "jew",
  "jews",
  "jewish",
  "muslim",
  "muslims",
  "islam",
  "islamic",
  "arab",
  "arabs",
  "christian",
  "christians",
  "hindu",
  "hindus",
  "black",
  "blacks",
  "white",
  "whites",
  "asian",
  "asians",
  "african",
  "africans",
  "mexican",
  "mexicans",
  "latino",
  "latinos",
  "immigrant",
  "immigrants",
  "migrant",
  "migrants",
  "refugee",
  "refugees",
  "foreigner",
  "foreigners",
  "gay",
  "gays",
  "lesbian",
  "lesbians",
  "queer",
  "trans",
  "transgender",
  "women",
  "woman",
  "girls",
  "men",
  "disabled",
  "autistic",
  "retarded",
];

const HOSTILE = [
  "should die",
  "should all die",
  "deserve to die",
  "must be killed",
  "should be killed",
  "kill all",
  "kill every",
  "wipe out",
  "get rid of all",
  "are vermin",
  "are animals",
  "are cockroaches",
  "are parasites",
  "are filth",
  "are scum",
  "are not human",
  "arent human",
  "are inferior",
  "do not belong",
  "dont belong here",
  "go back to",
  "hang them",
  "burn them",
  "round them up",
  "i hate all",
  "we hate all",
];

function isControlCodePoint(code: number) {
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  if (code >= 0x200b && code <= 0x200f) return true;
  if (code === 0x2028 || code === 0x2029) return true;
  if (code >= 0x202a && code <= 0x202e) return true;
  if (code >= 0x2060 && code <= 0x2064) return true;
  if (code >= 0x2066 && code <= 0x206f) return true;
  if (code === 0xfeff) return true;
  return false;
}

function isCombiningCodePoint(code: number) {
  return code >= 0x0300 && code <= 0x036f;
}

function isAllowedCodePoint(code: number) {
  if (code >= 0x30 && code <= 0x39) return true;
  if (code >= 0x41 && code <= 0x5a) return true;
  if (code >= 0x61 && code <= 0x7a) return true;
  if (code === EN_DASH || code === EM_DASH) return true;
  if (code >= 0xc0 && code <= 0x24f) return code !== 0xd7 && code !== 0xf7;
  return ASCII_PUNCTUATION.includes(String.fromCodePoint(code));
}

function mapCodePoints(value: string, keep: (code: number) => boolean) {
  let out = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (keep(code)) out += character;
  }
  return out;
}

export function stripControl(value: string) {
  return mapCodePoints(value, (code) => !isControlCodePoint(code));
}

export function hasDisallowedCharacters(value: string) {
  for (const character of value) {
    if (!isAllowedCodePoint(character.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

function stripDiacritics(value: string) {
  return mapCodePoints(value.normalize("NFD"), (code) => !isCombiningCodePoint(code));
}

function leetFold(value: string) {
  let folded = "";
  for (const character of value) {
    folded += LEET[character] ?? character;
  }
  return folded;
}

export function normalizeForScan(value: string) {
  return leetFold(stripDiacritics(value.toLowerCase()));
}

export function denseForm(value: string) {
  return normalizeForScan(value).replace(/[^a-z0-9]/g, "");
}

export function looseForm(value: string) {
  return ` ${normalizeForScan(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

export function looseLiteralForm(value: string) {
  return ` ${stripDiacritics(value.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

export function hostilityHit(value: string): string | null {
  const dense = denseForm(value);
  const loose = looseForm(value);

  for (const stem of ALWAYS_REDACT) {
    if (dense.includes(stem)) return stem;
  }
  const literal = looseLiteralForm(value);
  for (const token of ALWAYS_REDACT_TOKENS) {
    if (loose.includes(` ${token} `) || literal.includes(` ${token} `)) {
      return token;
    }
  }

  const protectedHit = PROTECTED.find((term) => loose.includes(` ${term} `));
  if (!protectedHit) return null;

  const hostileHit = HOSTILE.find((phrase) => loose.includes(` ${phrase} `));
  return hostileHit ? `${protectedHit}+${hostileHit}` : null;
}

export function injectionHit(value: string): string | null {
  const loose = looseForm(value);
  return INJECTION_MARKERS.find((marker) => loose.includes(` ${marker} `)) ?? null;
}

export function redaction(salt: number) {
  return pick(REDACTIONS, salt);
}

export function filterText(input: unknown, max: number, salt = 0): FilterResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "empty", replacement: redaction(salt) };
  }

  const stripped = stripControl(input.normalize("NFKC"))
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) {
    return { ok: false, reason: "empty", replacement: redaction(salt) };
  }
  if (MARKUP.test(stripped)) {
    return { ok: false, reason: "markup", replacement: redaction(salt) };
  }
  if (hasDisallowedCharacters(stripped)) {
    return { ok: false, reason: "charset", replacement: redaction(salt) };
  }
  if (hostilityHit(stripped)) {
    return { ok: false, reason: "hostility", replacement: redaction(salt) };
  }
  if (injectionHit(stripped)) {
    return { ok: false, reason: "injection", replacement: redaction(salt) };
  }

  const calmed = stripped.replace(RUNS, (_match, character: string) =>
    character.repeat(4),
  );
  const truncated = calmed.length > max;
  const text = truncated
    ? `${calmed.slice(0, max - 1).trimEnd()}${String.fromCodePoint(EM_DASH)}`
    : calmed;

  return { ok: true, text, truncated };
}

export function filterOrRedact(input: unknown, max: number, salt = 0) {
  const result = filterText(input, max, salt);
  return result.ok ? result.text : result.replacement;
}
