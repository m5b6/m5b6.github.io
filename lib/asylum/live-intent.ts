import "server-only";

import {
  ModelUnavailable,
  requestAct,
} from "@/lib/asylum/openrouter";
import {
  budgetKeyFor,
  readWardSpend,
  recordWardSpend,
} from "@/lib/asylum/store";
import { dreamAct, dreamWhisper } from "@/lib/asylum/dream";
import type { Inmate, WardState } from "@/lib/asylum/world";
import type { InmateAct } from "@/lib/asylum/tools";

/**
 * A free key without credit is capped at 50 requests a day, and one dollar of credit
 * raises that to 1000. Spending it in a burst would leave the ward mute for the rest of
 * the day, so the budget refills hourly and a spent hour dreams instead.
 */
export const CALLS_PER_HOUR = 24;

export type LiveTurn = {
  act: InmateAct | null;
  source: "dream" | "model";
};

async function withinBudget(budgetKey: string) {
  try {
    const spend = await readWardSpend(budgetKey);
    return spend.calls < CALLS_PER_HOUR;
  } catch {
    return false;
  }
}

/**
 * The model is asked, and the dream is what answers when it will not. A refusal, a rate
 * limit or a cold start is never surfaced: the ward simply speaks from the seed for that
 * turn, and the visitor sees a room that keeps going.
 */
export async function liveAct(
  state: WardState,
  inmate: Inmate,
  apiKey: string,
): Promise<LiveTurn> {
  const budgetKey = budgetKeyFor(apiKey);

  if (!(await withinBudget(budgetKey))) {
    return { act: dreamAct(state, inmate), source: "dream" };
  }

  try {
    const act = await requestAct(state, inmate, { apiKey });
    await recordWardSpend({ budgetKey, calls: 1 }).catch(() => {});
    return { act, source: "model" };
  } catch (error) {
    await recordWardSpend({ budgetKey, calls: 1 }).catch(() => {});

    if (!(error instanceof ModelUnavailable)) throw error;

    return { act: dreamAct(state, inmate), source: "dream" };
  }
}

export function liveWhisper(state: WardState) {
  return dreamWhisper(state);
}
