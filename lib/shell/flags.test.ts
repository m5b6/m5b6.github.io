import { describe, expect, test } from "vitest";
import { SHELL_FLAG, isShellEnabled, shellEnabled } from "@/lib/shell/flags";

describe("the desktop kill switch", () => {
  test("is on when nothing is configured", () => {
    expect(isShellEnabled(undefined)).toBe(true);
    expect(isShellEnabled("")).toBe(true);
  });

  test('is off only for the exact string "0"', () => {
    expect(isShellEnabled("0")).toBe(false);
    expect(isShellEnabled(" 0 ")).toBe(false);
    expect(isShellEnabled("1")).toBe(true);
    expect(isShellEnabled("false")).toBe(true);
    expect(isShellEnabled("00")).toBe(true);
  });

  test("reads the environment through the named flag", () => {
    const previous = process.env[SHELL_FLAG];
    try {
      process.env[SHELL_FLAG] = "0";
      expect(shellEnabled()).toBe(false);
      delete process.env[SHELL_FLAG];
      expect(shellEnabled()).toBe(true);
    } finally {
      if (previous === undefined) delete process.env[SHELL_FLAG];
      else process.env[SHELL_FLAG] = previous;
    }
  });
});
