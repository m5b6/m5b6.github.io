import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAST } from "./cast";
import { ModelUnavailable, requestAct, systemPrompt, toolsFor } from "./openrouter";
import { parseInmateAct } from "./tools";
import { createWard, findInmate } from "./world";

function loadLocalEnv() {
  if (process.env.OPENROUTER_API_KEY) return;

  try {
    const text = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");

    for (const line of text.split("\n")) {
      const match = /^([A-Z0-9_]+)="?([^"\n]*)"?$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {}
}

loadLocalEnv();

const apiKey = process.env.OPENROUTER_API_KEY;
/** Opt in with OPENROUTER_LIVE=1; every run spends real quota. */
const live = apiKey && process.env.OPENROUTER_LIVE === "1" ? describe : describe.skip;

/**
 * Talks to OpenRouter for real, so it costs quota and only runs with OPENROUTER_LIVE=1.
 *
 * Every inmate is cast to a different free model, and free models differ wildly in whether
 * they emit a tool call at all. Expect some turns to come back refused or rate limited:
 * that is the ward dreaming, not a broken client. Run this when the cast changes, because
 * OpenRouter moves models off the free tier without warning.
 */
live("a free model taking a turn in Ward 7", () => {
  const ward = createWard(7);

  it.each(CAST.map((member) => [member.name, member.id, member.model] as const))(
    "%s answers with a usable act",
    async (_name, id, model) => {
      const inmate = findInmate(ward, id)!;
      const tools = toolsFor(ward, inmate);

      expect(tools.length).toBeGreaterThan(0);
      expect(systemPrompt(ward, inmate)).toContain("Ward 7");

      try {
        const act = await requestAct(ward, inmate, { apiKey: apiKey! });

        expect(parseInmateAct(act)).not.toBeNull();
        console.log(`  ${_name} (${model}) -> ${JSON.stringify(act)}`);
      } catch (error) {
        if (error instanceof ModelUnavailable) {
          console.log(`  ${_name} (${model}) -> unavailable: ${error.reason}`);
          return;
        }

        throw error;
      }
    },
    45_000,
  );
});
