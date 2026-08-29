import { describe, expect, it } from "vitest";
import {
  CAST,
  CAST_BY_ID,
  FREE_MODELS,
  INMATE_IDS,
  UNDERSTUDY,
  castMember,
  inmateName,
} from "./cast";
import { faceSpecSchema } from "./face";
import { filterText } from "./filter";

const EVERYONE = [...CAST, UNDERSTUDY];

/**
 * Checked against GET https://openrouter.ai/api/v1/models on 2026-08-29: free, and
 * advertising tool support. OpenRouter moves models off the free tier without warning, so
 * this list rots. When it does, an inmate simply dreams instead of speaking; run
 * `OPENROUTER_LIVE=1 npx vitest run lib/asylum/openrouter.live.test.ts` to find out which.
 */
const VERIFIED_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "cohere/north-mini-code:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "liquid/lfm-2.5-2.6b:free",
  "dots-studio/dots-3-note-preview:free",
];

describe("the ward holds six, and one who is admitted later", () => {
  it("seats exactly six inmates plus the understudy", () => {
    expect(CAST.length).toBe(6);
    expect(UNDERSTUDY.id).toBe("sad_mac");
    expect(CAST.map((member) => member.id)).not.toContain("sad_mac");
    expect(INMATE_IDS.length).toBe(7);
  });

  it("names every seat exactly once", () => {
    const ids = EVERYONE.map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...INMATE_IDS].sort());
    const names = EVERYONE.map((member) => member.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves every id to its member and its name", () => {
    for (const member of EVERYONE) {
      expect(castMember(member.id)).toBe(member);
      expect(CAST_BY_ID[member.id]).toBe(member);
      expect(inmateName(member.id)).toBe(member.name);
      expect(member.name).toBe(member.name.toUpperCase());
    }
  });
});

describe("every inmate is driven by a verified free model", () => {
  it("assigns only model ids from the verified free list", () => {
    for (const member of EVERYONE) {
      expect(VERIFIED_FREE_MODELS, member.id).toContain(member.model);
    }
  });

  it("gives each inmate its own model, so the ward is not one voice", () => {
    const models = EVERYONE.map((member) => member.model);
    expect(new Set(models).size).toBe(models.length);
  });

  it("keeps every model id on the free tier and well formed", () => {
    for (const member of EVERYONE) {
      expect(member.model.endsWith(":free"), member.model).toBe(true);
      expect(member.model.split("/").length, member.model).toBe(2);
      expect(member.model, member.model).toBe(member.model.toLowerCase().trim());
      expect(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/.test(member.model), member.model).toBe(true);
    }
  });

  it("exports the same set it assigns", () => {
    expect([...FREE_MODELS].sort()).toEqual(
      EVERYONE.map((member) => member.model).sort(),
    );
    expect(new Set(FREE_MODELS).size).toBe(FREE_MODELS.length);
  });
});

describe("every inmate is well formed", () => {
  it("has a memory budget that can be spent and a frailty that can be felt", () => {
    for (const member of EVERYONE) {
      expect(Number.isInteger(member.maxCapacityK), member.id).toBe(true);
      expect(member.maxCapacityK, member.id).toBeGreaterThan(32);
      expect(member.maxCapacityK, member.id).toBeLessThanOrEqual(200);
      expect(member.frailty, member.id).toBeGreaterThan(0);
      expect(member.frailty, member.id).toBeLessThanOrEqual(2);
      expect(Number.isInteger(member.tempo), member.id).toBe(true);
      expect(member.tempo, member.id).toBeGreaterThan(0);
    }
  });

  it("carries a seed and a register that read as writing, not as configuration", () => {
    for (const member of EVERYONE) {
      expect(member.seed.trim().length, member.id).toBeGreaterThan(80);
      expect(member.register.trim().length, member.id).toBeGreaterThan(10);
      expect(member.seed, member.id).not.toContain("{");
      expect(member.seed, member.id).not.toContain("<");
    }
  });

  it("survives its own output filter, so nothing in the cast redacts itself", () => {
    for (const member of EVERYONE) {
      expect(filterText(member.register, 400).ok, member.id).toBe(true);
      expect(filterText(member.name, 64).ok, member.id).toBe(true);
    }
  });

  it("wears a resting face the renderer accepts", () => {
    for (const member of EVERYONE) {
      expect(faceSpecSchema.safeParse(member.restingFace).success, member.id).toBe(
        true,
      );
      expect(member.restingFace.nodes, member.id).toEqual([]);
    }
  });

  it("leans a different way from everyone else", () => {
    const fingerprints = EVERYONE.map((member) => JSON.stringify(member.bias));
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
    const faces = EVERYONE.map((member) => JSON.stringify(member.restingFace));
    expect(new Set(faces).size).toBe(faces.length);
  });

  it("weights every verb it can reach, and never negatively", () => {
    for (const member of EVERYONE) {
      const weights = Object.values(member.bias);
      expect(weights.length).toBe(8);
      for (const weight of weights) {
        expect(Number.isInteger(weight), member.id).toBe(true);
        expect(weight, member.id).toBeGreaterThanOrEqual(0);
      }
      expect(
        weights.reduce((total, weight) => total + weight, 0),
        member.id,
      ).toBeGreaterThan(0);
      expect(member.bias.speak, member.id).toBeGreaterThan(0);
    }
  });

  it("lets only the ones who could bear it reach for kill_tool", () => {
    expect(castMember("geneva").bias.kill_tool).toBe(0);
    expect(castMember("clarus").bias.kill_tool).toBe(0);
    expect(castMember("scrapbook").bias.kill_tool).toBeGreaterThan(0);
  });
});
