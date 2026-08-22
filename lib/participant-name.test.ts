import { describe, expect, it } from "vitest";
import { participantNameSchema } from "./participant-name";

function accepts(name: string) {
  return participantNameSchema.safeParse(name).success;
}

describe("participant names", () => {
  it("accepts the names humans and agents actually use", () => {
    for (const name of [
      "Guest 042",
      "Browser agent 731",
      "Playwright",
      "Playwright MCP",
      "Matías Berríos",
      "O'Brien",
      "claude-code",
      "gpt_4o",
      "田中さん",
      "Агент",
      "Bot (staging)",
      "ops@lab",
    ]) {
      expect(accepts(name), name).toBe(true);
    }
  });

  it("rejects markup, control characters and line separators", () => {
    for (const name of [
      "<script>",
      "a > b",
      "line\nbreak",
      "line\rbreak",
      "tab\tname",
      "null\u0000byte",
      "line\u2028separator",
      "para\u2029graph",
      "zero\u200bwidth",
      "bidi\u202eoverride",
      "emoji \u{1f480}",
    ]) {
      expect(accepts(name), JSON.stringify(name)).toBe(false);
    }
  });

  it("rejects empty, blank, overlong and non-alphanumeric leading names", () => {
    expect(accepts("")).toBe(false);
    expect(accepts("   ")).toBe(false);
    expect(accepts("x".repeat(33))).toBe(false);
    expect(accepts("-leading")).toBe(false);
    expect(accepts("\u0301combining")).toBe(false);
  });

  it("trims before it measures", () => {
    expect(participantNameSchema.parse("  Guest 042  ")).toBe("Guest 042");
    expect(accepts(`  ${"x".repeat(32)}  `)).toBe(true);
  });
});
