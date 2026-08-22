import { describe, expect, it } from "vitest";
import {
  MAX_TRASH_ENTRIES,
  describeTrash,
  totalTrashedPixels,
  trashRequestSchema,
  trashSnapshotSchema,
  type TrashEntry,
} from "@/lib/trash";

const entry = (revision: number, pixelCount: number): TrashEntry => ({
  revision,
  pixelCount,
  discardedBy: "guest-1",
  discardedAt: "2026-08-22T10:00:00.000Z",
});

describe("the trash wire contract", () => {
  it("accepts a Put Back with or without a revision", () => {
    const actor = { id: "guest-1", name: "Guest 001" };
    expect(
      trashRequestSchema.safeParse({ action: "putBack", participant: actor }).success,
    ).toBe(true);
    expect(
      trashRequestSchema.safeParse({
        action: "putBack",
        participant: actor,
        revision: 42,
      }).success,
    ).toBe(true);
  });

  it("refuses an unknown action, a bad name and a negative revision", () => {
    const actor = { id: "guest-1", name: "Guest 001" };
    expect(trashRequestSchema.safeParse({ action: "burn", participant: actor }).success).toBe(false);
    expect(
      trashRequestSchema.safeParse({
        action: "empty",
        participant: { id: "guest-1", name: "" },
      }).success,
    ).toBe(false);
    expect(
      trashRequestSchema.safeParse({
        action: "putBack",
        participant: actor,
        revision: -1,
      }).success,
    ).toBe(false);
  });

  it("refuses an identifier that is not an identifier", () => {
    expect(
      trashRequestSchema.safeParse({
        action: "empty",
        participant: { id: "guest 1; DROP TABLE", name: "Guest 001" },
      }).success,
    ).toBe(false);
  });

  it("caps how many discarded paintings a snapshot may carry", () => {
    const entries = Array.from({ length: MAX_TRASH_ENTRIES + 1 }, (_, index) =>
      entry(index, 1),
    );
    expect(trashSnapshotSchema.safeParse({ entries }).success).toBe(false);
    expect(trashSnapshotSchema.safeParse({ entries: entries.slice(1) }).success).toBe(true);
  });
});

describe("how the Trash describes itself", () => {
  it("says it is empty when it is", () => {
    expect(describeTrash([])).toBe("The Trash is empty.");
    expect(totalTrashedPixels([])).toBe(0);
  });

  it("counts paintings and pixels", () => {
    expect(describeTrash([entry(1, 1)])).toBe("1 painting, 1 pixel");
    expect(describeTrash([entry(1, 19_824), entry(2, 176)])).toBe(
      "2 paintings, 20,000 pixels",
    );
    expect(totalTrashedPixels([entry(1, 19_824), entry(2, 176)])).toBe(20_000);
  });
});
