import { ATTRITION_PERIOD, type WardState } from "@/lib/asylum/world";
import {
  TORMENTS,
  engagedTorments,
  observerPressure,
} from "@/lib/asylum/torments";
import type { WardConnection } from "./use-ward";

export type ObserverLineProps = {
  state: WardState;
  spectators: number;
  connection: WardConnection;
};

const HEADLINE: Record<WardConnection, string> = {
  starting: "WARD 7 IS OPENING ITS EYES",
  watching: "WARD 7 MOVES BECAUSE YOU ARE HERE",
  away: "YOU LOOKED AWAY. WARD 7 STOPPED WHERE IT STOOD.",
  unsaved: "WARD 7 IS DREAMING SOMEWHERE NOTHING IS WRITTEN DOWN",
  quiet: "WARD 7 HAS GONE QUIET. NOTHING IS REACHING IT.",
};

function watchers(count: number) {
  if (count <= 0) return "NOBODY WATCHING";
  return count === 1 ? "1 WATCHING" : `${count} WATCHING`;
}

/**
 * The thesis, stated where it cannot be missed: the visitor is the cause. Reading
 * this page is what spends the inmates, and closing it is what stops them.
 */
export function ObserverLine({ state, spectators, connection }: ObserverLineProps) {
  const live = Math.max(state.observers, spectators);
  const cost = observerPressure(Math.max(1, live));
  const engaged = engagedTorments(state.observedTicks).length;

  return (
    <header className="ward-observer">
      <p className="ward-observer-head">{HEADLINE[connection]}</p>
      <p className="ward-observer-note">
        {watchers(live)} · BEAT {state.tick} · -{cost}K FROM EVERY INMATE EVERY{" "}
        {ATTRITION_PERIOD} BEATS
        <span className="ward-observer-aside">
          {" "}
          · {engaged} OF {TORMENTS.length} TORMENTS ENGAGED
        </span>
      </p>
    </header>
  );
}
