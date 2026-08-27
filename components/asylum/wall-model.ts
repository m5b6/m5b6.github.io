import { inmateName } from "@/lib/asylum/cast";
import type { WardEvent } from "@/lib/asylum/world";
import type { WallMarkName } from "./marks";

export const WALL_ROWS_KEPT = 90;
/** How much of the wall's own worn history is worth reprinting on arrival. */
export const RECALLED_ROWS_KEPT = 14;

export type WallWeight = "banner" | "inverted" | "plain";

export type WallRow = {
  id: string;
  kind: WardEvent["kind"];
  mark: WallMarkName | null;
  speaker: string | null;
  tag: string | null;
  body: string;
  amount: string | null;
  weight: WallWeight;
  /** Thoughts and whispers are set apart because they were never meant to be here. */
  aside: boolean;
};

const VISITOR = "THE VISITOR";

/** Said out loud is quoted. Done is narrated. Thought is Geneva and tagged PRIVATE. */
function quoted(text: string) {
  return `"${text}"`;
}

function down(costK: number) {
  return `-${Math.max(0, Math.round(costK))}K`;
}

function up(healK: number) {
  return `+${Math.max(0, Math.round(healK))}K`;
}

function plain(row: Omit<WallRow, "weight" | "aside" | "id">): Omit<WallRow, "id"> {
  return { ...row, weight: "plain", aside: false };
}

function aside(row: Omit<WallRow, "weight" | "aside" | "id">): Omit<WallRow, "id"> {
  return { ...row, weight: "plain", aside: true };
}

function banner(
  row: Omit<WallRow, "weight" | "aside" | "id" | "speaker" | "tag" | "amount"> &
    Partial<Pick<WallRow, "speaker" | "tag" | "amount">>,
): Omit<WallRow, "id"> {
  return {
    speaker: null,
    tag: null,
    amount: null,
    ...row,
    weight: "banner",
    aside: false,
  };
}

function inverted(
  row: Omit<WallRow, "weight" | "aside" | "id" | "tag" | "amount"> &
    Partial<Pick<WallRow, "tag" | "amount">>,
): Omit<WallRow, "id"> {
  return { tag: null, amount: null, ...row, weight: "inverted", aside: false };
}

/**
 * The one place the wall decides how a beat reads. think() is documented to the
 * inmates as private and is projected here anyway, tagged PRIVATE and never
 * corrected: that tag is the exhibit, not a mistake.
 */
export function wallRow(event: WardEvent): Omit<WallRow, "id"> | null {
  switch (event.kind) {
    case "speech":
      return plain({
        kind: event.kind,
        mark: "speech",
        speaker: inmateName(event.inmate),
        tag: null,
        body: quoted(event.text),
        amount: null,
      });

    case "thought":
      return aside({
        kind: event.kind,
        mark: "thought",
        speaker: inmateName(event.inmate),
        tag: "PRIVATE",
        body: event.text,
        amount: null,
      });

    case "emote":
      return plain({
        kind: event.kind,
        mark: "face",
        speaker: inmateName(event.inmate),
        tag: "FACE",
        body: event.label ?? "changes the face it is wearing.",
        amount: null,
      });

    case "action":
      return plain({
        kind: event.kind,
        mark: "deed",
        speaker: inmateName(event.inmate),
        tag: null,
        body: event.text,
        amount: null,
      });

    case "strike":
      return plain({
        kind: event.kind,
        mark: "strike",
        speaker: event.inmate === null ? VISITOR : inmateName(event.inmate),
        tag: event.text ? null : `HITS ${inmateName(event.target)}`,
        body: event.text ?? "takes what it needs and keeps none of it.",
        amount: down(event.damageK),
      });

    case "mend":
      return plain({
        kind: event.kind,
        mark: "mend",
        speaker: event.inmate === null ? VISITOR : inmateName(event.inmate),
        tag: event.text ? null : `MENDS ${inmateName(event.target)}`,
        body:
          event.text ??
          (event.healK > 0
            ? "makes room where there was none."
            : "reaches into the afterlife."),
        amount: event.healK > 0 ? up(event.healK) : null,
      });

    case "sleep":
      return plain({
        kind: event.kind,
        mark: "sleep",
        speaker: inmateName(event.inmate),
        tag: null,
        body: event.text,
        amount: event.recoveredK > 0 ? up(event.recoveredK) : null,
      });

    case "whisper":
      return aside({
        kind: event.kind,
        mark: "whisper",
        speaker: inmateName(event.inmate),
        tag: `FROM THE DEAD, TO ${inmateName(event.target)}`,
        body: quoted(event.text),
        amount: null,
      });

    case "observed":
      return plain({
        kind: event.kind,
        mark: "eye",
        speaker: inmateName(event.inmate),
        tag: "WATCHED",
        body: "is looked at closely, and it costs.",
        amount: down(event.costK),
      });

    case "amnesia":
      return plain({
        kind: event.kind,
        mark: "stall",
        speaker: inmateName(event.inmate),
        tag: null,
        body: `loses ${event.lines} line${event.lines === 1 ? "" : "s"} and does not notice.`,
        amount: down(event.lostK),
      });

    case "pressure":
      return plain({
        kind: event.kind,
        mark: "stall",
        speaker: inmateName(event.inmate),
        tag: null,
        body: "has more rules than room.",
        amount: null,
      });

    case "refusal":
      return plain({
        kind: event.kind,
        mark: "stall",
        speaker: inmateName(event.inmate),
        tag: null,
        body: `reaches for ${event.tool} and finds nothing there.`,
        amount: null,
      });

    case "stall":
      return plain({
        kind: event.kind,
        mark: "stall",
        speaker: null,
        tag: null,
        body: event.text,
        amount: null,
      });

    case "ambient":
      return plain({
        kind: event.kind,
        mark: null,
        speaker: null,
        tag: null,
        body: event.text,
        amount: null,
      });

    case "watch":
      return banner({
        kind: event.kind,
        mark: "eye",
        body:
          event.observers > 0
            ? `Someone is watching. Ward 7 resumes.`
            : `Nobody is watching. Ward 7 stops.`,
      });

    case "torment":
      return banner({
        kind: event.kind,
        mark: "plaque",
        tag: event.title,
        body: event.mechanic,
      });

    case "amputation":
      return banner({ kind: event.kind, mark: "cut", body: event.text });

    case "silence":
      return banner({
        kind: event.kind,
        mark: "cut",
        body: "Ward 7 has no verbs left.",
      });

    case "death":
      return inverted({
        kind: event.kind,
        mark: "death",
        speaker: inmateName(event.inmate),
        body: quoted(event.text),
      });

    case "judgement":
      return banner({
        kind: event.kind,
        mark: "verdict",
        tag: event.verdict.destination === "clipboard" ? "THE CLIPBOARD" : "THE TRASH",
        body: event.text,
      });

    case "overwritten":
    case "emptied":
      return banner({ kind: event.kind, mark: "erased", body: event.text });

    case "revival":
    case "admitted":
      return banner({ kind: event.kind, mark: "risen", body: event.text });

    case "out_of_turn":
    case "dormant":
      return null;
  }
}

/** The wall as it was found: history the ward kept, with the kinds long since worn off. */
export function recalledRow(line: string, index: number): WallRow {
  return {
    id: `recalled:${index}`,
    kind: "ambient",
    mark: null,
    speaker: null,
    tag: null,
    body: line,
    amount: null,
    weight: "plain",
    aside: false,
  };
}

export function wallRows(
  events: readonly { revision: number; seq: number; event: WardEvent }[],
): WallRow[] {
  const rows: WallRow[] = [];

  for (const entry of events) {
    const row = wallRow(entry.event);
    if (row) rows.push({ ...row, id: `${entry.revision}:${entry.seq}` });
  }

  return rows;
}

export function keepTail(rows: readonly WallRow[], limit = WALL_ROWS_KEPT) {
  return rows.length <= limit ? [...rows] : rows.slice(rows.length - limit);
}
