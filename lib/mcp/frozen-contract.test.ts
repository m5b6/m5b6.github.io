import { describe, expect, it } from "vitest";
import {
  legacyParticipantNameSchema,
  participantNameSchema,
  sanitizeParticipantName,
} from "@/lib/participant-name";

const NAMES_LIVE_AGENTS_USE = [
  "Claude",
  "Claude 🤖",
  "[bot]",
  "_agent",
  "gpt-4|v2",
  "a;b",
  "研究エージェント",
  "agent<3",
  "{{name}}",
  "~scout~",
];

describe("frozen agent-name contract", () => {
  it.each(NAMES_LIVE_AGENTS_USE)(
    "keeps accepting %j, which the live endpoint accepts today",
    (name) => {
      expect(legacyParticipantNameSchema.safeParse(name).success).toBe(true);
    },
  );

  it("rejects only what the published JSON Schema already rejects", () => {
    expect(legacyParticipantNameSchema.safeParse("").success).toBe(false);
    expect(legacyParticipantNameSchema.safeParse("x".repeat(33)).success).toBe(
      false,
    );
  });

  it("never lets markup or control characters reach a rendered name", () => {
    expect(sanitizeParticipantName("</script><svg onload=alert(1)>")).not.toMatch(
      /[<>]/,
    );
    expect(sanitizeParticipantName("a  b")).toBe("a b");
    expect(sanitizeParticipantName("   ")).toBe("Someone");
    expect(sanitizeParticipantName("Claude 🤖")).toBe("Claude 🤖");
  });

  it("keeps the stricter allowlist off the frozen tools", () => {
    expect(participantNameSchema.safeParse("[bot]").success).toBe(false);
    expect(legacyParticipantNameSchema.safeParse("[bot]").success).toBe(true);
  });
});
