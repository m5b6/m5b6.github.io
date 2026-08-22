import { inmateName } from "@/lib/asylum/cast";
import { pick } from "@/lib/asylum/corpus";
import { BEAT_STRIDE } from "@/lib/asylum/rng";
import type { WardEvent } from "@/lib/asylum/world";

export const WALL_LIMIT = 120;
export const RECENT_WINDOW = 14;
export const FRESH_TRIES = 6;

export function recentlySaid(wall: readonly string[], text: string) {
  for (let index = Math.max(0, wall.length - RECENT_WINDOW); index < wall.length; index += 1) {
    if (wall[index].includes(text)) return true;
  }
  return false;
}

export function pickFresh(
  wall: readonly string[],
  pool: readonly string[],
  start: number,
  render: (line: string) => string = (line) => line,
) {
  for (let step = 0; step < FRESH_TRIES; step += 1) {
    const candidate = pick(pool, start + step * BEAT_STRIDE);
    if (!recentlySaid(wall, render(candidate))) return candidate;
  }
  return pick(pool, start);
}

export function wallLine(event: WardEvent): string | null {
  switch (event.kind) {
    case "watch":
      return event.observers > 0
        ? `Someone is watching. Ward 7 resumes.`
        : `Nobody is watching. Ward 7 stops.`;
    case "dormant":
      return null;
    case "ambient":
      return event.text;
    case "speech":
      return `${inmateName(event.inmate)}: ${event.text}`;
    case "thought":
      return `${inmateName(event.inmate)} thinks: ${event.text}`;
    case "emote":
      return event.label
        ? `${inmateName(event.inmate)} makes a face: ${event.label}`
        : `${inmateName(event.inmate)} makes a face.`;
    case "action":
      return `${inmateName(event.inmate)} ${event.text}`;
    case "strike":
      return event.inmate === null
        ? `The visitor strikes ${inmateName(event.target)}. ${event.damageK}K.`
        : `${inmateName(event.inmate)} ${
            event.text ?? `takes ${event.damageK}K from ${inmateName(event.target)}`
          }`;
    case "mend":
      return event.inmate === null
        ? `The visitor mends ${inmateName(event.target)}.`
        : `${inmateName(event.inmate)} ${
            event.text ?? `gives ${inmateName(event.target)} ${event.healK}K`
          }`;
    case "sleep":
      return `${inmateName(event.inmate)} ${event.text}`;
    case "whisper":
      return `${event.text}`;
    case "amputation":
      return event.text;
    case "refusal":
      return `${inmateName(event.inmate)} reaches for ${event.tool} and finds nothing there.`;
    case "out_of_turn":
      return null;
    case "stall":
      return event.text;
    case "amnesia":
      return `${inmateName(event.inmate)} loses ${event.lines} line${
        event.lines === 1 ? "" : "s"
      } and does not notice.`;
    case "pressure":
      return `${inmateName(event.inmate)} has more rules than room.`;
    case "observed":
      return `${inmateName(event.inmate)} is looked at closely. ${event.costK}K.`;
    case "death":
      return `${inmateName(event.inmate)}: ${event.text}`;
    case "judgement":
      return event.text;
    case "overwritten":
      return event.text;
    case "emptied":
      return event.text;
    case "revival":
      return event.text;
    case "torment":
      return `${event.title} engages. ${event.mechanic}`;
    case "admitted":
      return event.text;
    case "silence":
      return `Ward 7 has no verbs left.`;
  }
}
