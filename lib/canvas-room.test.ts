import { describe, expect, it } from "vitest";
import { CANVAS_ROOM_ID } from "@/lib/canvas";
import {
  assertDisposableRoom,
  isProductionRoom,
  resolveRoomId,
} from "@/lib/canvas-room";

describe("canvas room resolution", () => {
  it("uses the bare room only in production", () => {
    expect(resolveRoomId({ VERCEL_ENV: "production" })).toBe(CANVAS_ROOM_ID);
    expect(isProductionRoom({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("suffixes every other environment so it can never touch production art", () => {
    for (const env of ["preview", "development", undefined]) {
      const room = resolveRoomId({ VERCEL_ENV: env });

      expect(room).not.toBe(CANVAS_ROOM_ID);
      expect(room.startsWith(`${CANVAS_ROOM_ID}:`)).toBe(true);
      expect(isProductionRoom({ VERCEL_ENV: env })).toBe(false);
    }
  });

  it("treats an explicit override pointed at production as production", () => {
    expect(isProductionRoom({ CANVAS_ROOM_ID })).toBe(true);
  });
});

describe("destructive-test guard", () => {
  it("allows a suffixed room", () => {
    expect(() => assertDisposableRoom({ VERCEL_ENV: "development" })).not.toThrow();
  });

  it("refuses the production room, however it was reached", () => {
    expect(() => assertDisposableRoom({ VERCEL_ENV: "production" })).toThrow(
      /production canvas room/i,
    );
    expect(() => assertDisposableRoom({ CANVAS_ROOM_ID })).toThrow(
      /production canvas room/i,
    );
  });
});
