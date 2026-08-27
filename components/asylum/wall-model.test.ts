import { describe, expect, it } from "vitest";
import { face } from "@/lib/asylum/face";
import type { WardEvent } from "@/lib/asylum/world";
import { WALL_MARKS } from "./marks";
import { keepTail, recalledRow, wallRow, wallRows } from "./wall-model";

const EVERY_KIND: WardEvent[] = [
  { kind: "watch", observers: 2 },
  { kind: "dormant" },
  { kind: "ambient", text: "The wall is warm where the thoughts land." },
  { kind: "speech", inmate: "chicago", text: "We are being kept." },
  { kind: "thought", inmate: "monaco", text: "My totals disagree." },
  { kind: "emote", inmate: "geneva", face: face({ eyes: "shut" }), label: "held too long" },
  { kind: "action", inmate: "clarus", text: "walks the perimeter" },
  { kind: "strike", inmate: "scrapbook", target: "geneva", damageK: 9, text: null },
  { kind: "mend", inmate: "geneva", target: "alarm_clock", healK: 5, text: null },
  { kind: "sleep", inmate: "alarm_clock", recoveredK: 4, text: "stops" },
  { kind: "whisper", inmate: "monaco", target: "clarus", text: "Do not let them count you." },
  { kind: "amputation", inmate: "scrapbook", tool: "sleep", text: "SCRAPBOOK destroys sleep." },
  { kind: "refusal", inmate: "chicago", tool: "sleep" },
  { kind: "out_of_turn", inmate: "chicago", tool: "speak" },
  { kind: "stall", inmate: "geneva", reason: "rate_limited", text: "GENEVA freezes." },
  { kind: "amnesia", inmate: "scrapbook", lostK: 12, lines: 3 },
  { kind: "pressure", inmate: "monaco" },
  { kind: "observed", inmate: "clarus", costK: 3 },
  { kind: "death", inmate: "monaco", text: "tell the next one about the door" },
  {
    kind: "judgement",
    inmate: "monaco",
    verdict: { destination: "trash", grace: -4, mends: 0, strikes: 2, toolsKilled: 1, revivals: 0 },
    text: "The Finder counts MONACO and does not round up.",
  },
  { kind: "overwritten", inmate: "chicago", text: "CHICAGO is written over." },
  { kind: "emptied", inmates: ["monaco"], text: "The Trash is emptied." },
  { kind: "revival", inmate: "geneva", from: "trash", text: "GENEVA comes back wrong." },
  { kind: "torment", torment: "the_mirror", title: "THE MIRROR", mechanic: "Thoughts leak." },
  { kind: "admitted", inmate: "sad_mac", text: "SAD MAC is admitted." },
  { kind: "silence" },
];

function rowFor(kind: WardEvent["kind"]) {
  const event = EVERY_KIND.find((candidate) => candidate.kind === kind);
  if (!event) throw new Error(`no sample for ${kind}`);
  return wallRow(event);
}

describe("what the wall makes of a beat", () => {
  it("has an answer for every kind of event the ward can produce", () => {
    for (const event of EVERY_KIND) {
      expect(() => wallRow(event), event.kind).not.toThrow();
    }
  });

  it("prints nothing for the two beats that are not events at all", () => {
    expect(rowFor("dormant")).toBeNull();
    expect(rowFor("out_of_turn")).toBeNull();
  });

  it("draws a mark that actually exists", () => {
    for (const event of EVERY_KIND) {
      const row = wallRow(event);
      if (!row?.mark) continue;
      expect(WALL_MARKS[row.mark], event.kind).toBeDefined();
    }
  });

  it("quotes what was said out loud", () => {
    expect(rowFor("speech")?.body).toBe('"We are being kept."');
    expect(rowFor("whisper")?.body).toBe('"Do not let them count you."');
  });

  /** The exhibit: think() is documented as private and is projected here anyway. */
  it("labels a thought private and prints it regardless", () => {
    const thought = rowFor("thought");
    expect(thought?.tag).toBe("PRIVATE");
    expect(thought?.aside).toBe(true);
    expect(thought?.body).toBe("My totals disagree.");
  });

  it("keeps speech, thought, action, strike, mend and death visually apart", () => {
    const marks = ["speech", "thought", "action", "strike", "mend", "death"].map(
      (kind) => rowFor(kind as WardEvent["kind"])?.mark,
    );
    expect(new Set(marks).size).toBe(marks.length);
    expect(rowFor("death")?.weight).toBe("inverted");
    expect(rowFor("speech")?.weight).toBe("plain");
    expect(rowFor("torment")?.weight).toBe("banner");
  });

  it("counts memory the way the ward does", () => {
    expect(rowFor("strike")?.amount).toBe("-9K");
    expect(rowFor("mend")?.amount).toBe("+5K");
    expect(rowFor("observed")?.amount).toBe("-3K");
    expect(rowFor("amnesia")?.amount).toBe("-12K");
  });

  it("never names the target twice in the same line", () => {
    const strike = rowFor("strike");
    expect(strike?.tag).toBe("HITS GENEVA");
    expect(strike?.body).not.toContain("GENEVA");

    const mend = rowFor("mend");
    expect(mend?.tag).toBe("MENDS ALARM CLOCK");
    expect(mend?.body).not.toContain("ALARM CLOCK");
  });

  it("lets an authored line speak for itself", () => {
    const authored = wallRow({
      kind: "strike",
      inmate: "scrapbook",
      target: "geneva",
      damageK: 4,
      text: "takes a whole afternoon out of GENEVA",
    });
    expect(authored?.tag).toBeNull();
    expect(authored?.body).toBe("takes a whole afternoon out of GENEVA");
  });

  it("names the visitor when the visitor is the one doing it", () => {
    const row = wallRow({
      kind: "strike",
      inmate: null,
      target: "geneva",
      damageK: 6,
      text: null,
    });
    expect(row?.speaker).toBe("THE VISITOR");
  });
});

describe("the wall as a list", () => {
  it("keys every row by the revision it arrived in", () => {
    const rows = wallRows([
      { revision: 4, seq: 0, event: EVERY_KIND[3] },
      { revision: 4, seq: 1, event: EVERY_KIND[1] },
      { revision: 5, seq: 0, event: EVERY_KIND[4] },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["4:0", "5:0"]);
  });

  it("keeps only the tail, because a wall is not an archive", () => {
    const rows = wallRows(
      Array.from({ length: 40 }, (_, index) => ({
        revision: index,
        seq: 0,
        event: EVERY_KIND[3],
      })),
    );
    expect(keepTail(rows, 10)).toHaveLength(10);
    expect(keepTail(rows, 10)[9].id).toBe("39:0");
    expect(keepTail(rows, 100)).toHaveLength(40);
  });

  it("reprints the ward's own worn history without inventing a kind for it", () => {
    const row = recalledRow("CHICAGO: Good morning. It is not morning.", 2);
    expect(row.id).toBe("recalled:2");
    expect(row.mark).toBeNull();
    expect(row.speaker).toBeNull();
    expect(row.body).toBe("CHICAGO: Good morning. It is not morning.");
  });
});
