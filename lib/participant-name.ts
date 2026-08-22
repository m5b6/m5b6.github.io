import { z } from "zod";

export const PARTICIPANT_NAME_MAX = 32;

const PARTICIPANT_NAME_PATTERN =
  /^[\p{L}\p{N}][\p{L}\p{M}\p{N} !#&'()+,./:?@_-]*$/u;

const UNSAFE_DISPLAY = /[\p{C}\p{Zl}\p{Zp}<>]/gu;

export function isParticipantName(value: string) {
  return PARTICIPANT_NAME_PATTERN.test(value);
}

export function sanitizeParticipantName(value: string) {
  const cleaned = value
    .replace(UNSAFE_DISPLAY, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, PARTICIPANT_NAME_MAX);

  return cleaned || "Someone";
}

export const participantNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PARTICIPANT_NAME_MAX)
  .refine(isParticipantName, {
    message: "Name may only contain letters, digits, spaces and light punctuation",
  });

export const legacyParticipantNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PARTICIPANT_NAME_MAX);
