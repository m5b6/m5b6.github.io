import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { MAC_ICONS, MAC_ICON_NAMES } from "@/components/mac/icon-art";
import { pixelRuns } from "@/components/mac/mac-pixel-art";

const ROOT = join(import.meta.dirname, "..", "..");
const MAC_DIR = join(ROOT, "components", "mac");
const STYLES_DIR = join(ROOT, "styles");

const TOKENS_FILE = "tokens.css";
const VENDORED_FILE = "system.css";

const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const FUNCTIONAL_COLOUR = /\b(?:rgba?|hsla?|oklch|color-mix)\(/g;

function macFiles() {
  return readdirSync(MAC_DIR)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => ({ name: `components/mac/${name}`, source: readFileSync(join(MAC_DIR, name), "utf8") }));
}

function authoredStylesheets() {
  return readdirSync(STYLES_DIR)
    .filter((name) => name.endsWith(".css") && name !== TOKENS_FILE && name !== VENDORED_FILE)
    .map((name) => ({ name: `styles/${name}`, source: readFileSync(join(STYLES_DIR, name), "utf8") }));
}

function everyAuthoredFile() {
  return [...macFiles(), ...authoredStylesheets()];
}

describe("only styles/tokens.css may name a colour", () => {
  test.each(everyAuthoredFile())("$name has no hex colour", ({ source }) => {
    expect(source.match(HEX) ?? []).toEqual([]);
  });

  test.each(everyAuthoredFile())("$name has no functional colour", ({ source }) => {
    expect(source.match(FUNCTIONAL_COLOUR) ?? []).toEqual([]);
  });

  test("styles/tokens.css is where the colours actually live", () => {
    const tokens = readFileSync(join(STYLES_DIR, TOKENS_FILE), "utf8");
    expect(tokens.match(HEX)?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("the authored layer honours the law", () => {
  const authored = authoredStylesheets();

  test.each(authored)("$name rounds nothing", ({ source }) => {
    const radii = source.match(/border-radius:\s*([^;]+);/g) ?? [];
    for (const rule of radii) {
      expect(rule).toBe("border-radius: var(--mac-radius);");
    }
  });

  test.each(authored)("$name casts only the Macintosh drop shadow", ({ source }) => {
    const shadows = source.match(/box-shadow:\s*([^;]+);/g) ?? [];
    for (const rule of shadows) {
      expect(rule).toBe("box-shadow: var(--mac-shadow);");
    }
  });

  test.each(authored)("$name references only defined tokens", ({ source }) => {
    const tokens = readFileSync(join(STYLES_DIR, TOKENS_FILE), "utf8");
    const defined = new Set(
      [...tokens.matchAll(/^\s*(--mac-[a-z0-9-]+):/gm)].map((match) => match[1]),
    );
    const referenced = new Set(
      [...source.matchAll(/var\((--mac-[a-z0-9-]+)/g)].map((match) => match[1]),
    );
    const undefinedTokens = [...referenced].filter(
      (token) => !defined.has(token) && !token.startsWith("--mac-art-"),
    );
    expect(undefinedTokens).toEqual([]);
  });

  test.each(authored)("$name sits on the pixel grid", ({ source }) => {
    const offGrid = source.match(/\b\d*\.?\d+(?:r?em)\b|\b\d+\.\d+px\b/g) ?? [];
    expect(offGrid).toEqual([]);
  });

  test("every token the palette defines is actually used", () => {
    const tokens = readFileSync(join(STYLES_DIR, TOKENS_FILE), "utf8");
    const defined = [...tokens.matchAll(/^\s*(--mac-[a-z0-9-]+):/gm)].map((match) => match[1]);
    const everything = [
      tokens,
      ...authored.map((file) => file.source),
      ...macFiles().map((file) => file.source),
    ].join("\n");
    const unused = defined.filter((token) => !everything.includes(`var(${token})`));
    expect(unused).toEqual([]);
  });
});

describe("pixel art", () => {
  test("every icon is a 32 by 32 grid", () => {
    for (const name of MAC_ICON_NAMES) {
      const rows = MAC_ICONS[name];
      expect(rows).toHaveLength(32);
      for (const row of rows) expect(row).toHaveLength(32);
    }
  });

  test("icons use only ink, paper and transparent cells", () => {
    for (const name of MAC_ICON_NAMES) {
      for (const row of MAC_ICONS[name]) {
        expect(row).toMatch(/^[#o.]{32}$/);
      }
    }
  });

  test("runs collapse neighbouring cells and drop the transparent ones", () => {
    expect(pixelRuns(["..##oo.#"])).toEqual([
      [
        { x: 2, width: 2, ink: true },
        { x: 4, width: 2, ink: false },
        { x: 7, width: 1, ink: true },
      ],
    ]);
  });

  test("a fully transparent row emits nothing", () => {
    expect(pixelRuns(["...."])).toEqual([[]]);
  });
});

describe("the library ships its own stylesheet", () => {
  test("the barrel imports the Macintosh stylesheet", () => {
    const barrel = readFileSync(join(MAC_DIR, "index.ts"), "utf8");
    expect(barrel).toContain('import "@/styles/mac.css"');
  });

  test("the stylesheet pulls in the token palette", () => {
    const mac = readFileSync(join(STYLES_DIR, "mac.css"), "utf8");
    expect(mac.startsWith('@import "./tokens.css";')).toBe(true);
  });

  test("the barrel exports every component module", () => {
    const barrel = readFileSync(join(MAC_DIR, "index.ts"), "utf8");
    const modules = readdirSync(MAC_DIR)
      .filter((name) => name.endsWith(".tsx"))
      .filter((name) => !name.includes(".test.") && name !== "gallery.tsx")
      .map((name) => name.replace(/\.tsx$/, ""));
    for (const name of modules) {
      expect(barrel).toContain(`from "./${name}"`);
    }
  });
});
