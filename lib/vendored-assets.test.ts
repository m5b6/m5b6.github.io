import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FACES,
  SPRITES,
  readUpstream,
  vendorSystemCss,
} from "../scripts/vendor-system-css";

const root = join(import.meta.dirname, "..");
const upstream = readUpstream(root);
const vendored = readFileSync(join(root, "styles", "system.css"), "utf8");
const globals = readFileSync(join(root, "app", "globals.css"), "utf8");

function digest(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("vendored macintosh stylesheet", () => {
  it("matches a fresh vendoring of the installed package", () => {
    expect(vendored).toBe(vendorSystemCss(upstream.source, upstream.version));
  });

  it("declares each face once, self-hosted, with a font-display", () => {
    const declarations = vendored.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(declarations).toHaveLength(FACES.length);

    for (const [index, face] of FACES.entries()) {
      expect(declarations[index]).toContain(`font-family: ${face.family};`);
      expect(declarations[index]).toContain(`url("/assets/fonts/${face.vendored}")`);
      expect(declarations[index]).toContain("font-display: block;");
    }
  });

  it("keeps the vendored bytes identical to the installed package", () => {
    for (const face of FACES) {
      expect(
        digest(join(root, "public", "assets", "fonts", face.vendored)),
        face.vendored,
      ).toBe(digest(join(upstream.dist, face.upstream)));
    }

    for (const sprite of SPRITES) {
      expect(digest(join(root, "public", "assets", "system", sprite)), sprite).toBe(
        digest(join(upstream.dist, sprite)),
      );
    }
  });

  it("never reaches a remote host from a stylesheet", () => {
    for (const sheet of [vendored, globals]) {
      expect(sheet).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//);
      expect(sheet).not.toContain("@import");
    }
  });
});
