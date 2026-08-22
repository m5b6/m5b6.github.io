import { describe, expect, it } from "vitest";
import { MIGRATIONS, pendingMigrations, type Migration } from "./migrations";

const unordered: Migration[] = [
  { version: 3, sql: "SELECT 3" },
  { version: 1, sql: "SELECT 1" },
  { version: 2, sql: "SELECT 2" },
];

describe("migrations", () => {
  it("ships strictly ascending, unique versions starting at 1", () => {
    const versions = MIGRATIONS.map(({ version }) => version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions[0]).toBe(1);
  });

  it("applies every migration in version order on an empty database", () => {
    expect(pendingMigrations([], unordered).map(({ version }) => version)).toEqual([
      1, 2, 3,
    ]);
  });

  it("is idempotent once every version is recorded", () => {
    expect(pendingMigrations([3, 2, 1], unordered)).toEqual([]);
    expect(
      pendingMigrations(
        MIGRATIONS.map(({ version }) => version),
        MIGRATIONS,
      ),
    ).toEqual([]);
  });

  it("replays only the versions a partially migrated database is missing", () => {
    expect(pendingMigrations([1], unordered).map(({ version }) => version)).toEqual([
      2, 3,
    ]);
    expect(pendingMigrations([1, 3], unordered).map(({ version }) => version)).toEqual(
      [2],
    );
  });

  it("ignores recorded versions that no longer exist in code", () => {
    expect(pendingMigrations([1, 2, 3, 99], unordered)).toEqual([]);
  });

  it("only ever appends, so an old database is never rewritten", () => {
    const [first, second, third] = MIGRATIONS;
    expect(first.sql).toContain("canvas_pixels");
    expect(second.sql).toContain("canvas_rate_limits");
    expect(third.sql).toContain("canvas_trash");
    for (const migration of MIGRATIONS) {
      expect(migration.sql, `migration ${migration.version}`).not.toMatch(
        /DROP\s+TABLE|ALTER\s+TABLE\s+\w+\s+DROP/i,
      );
    }
  });

  it("gives the Trash a home keyed by the revision that discarded the painting", () => {
    const trash = MIGRATIONS.find(({ version }) => version === 3);
    expect(trash?.sql).toContain("CREATE TABLE IF NOT EXISTS canvas_trash");
    expect(trash?.sql).toContain("PRIMARY KEY (room_id, revision)");
    expect(trash?.sql).toContain("pixels jsonb NOT NULL");
  });
});
