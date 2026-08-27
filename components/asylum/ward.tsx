"use client";

import { MacScrollArea, MacStatusBar } from "@/components/mac";
import { ASYLUM_WARD_NAME } from "@/lib/asylum/cast";
import { livingInmates } from "@/lib/asylum/world";
import { Afterlife } from "./afterlife";
import { ObserverLine } from "./observer-line";
import { ToolRack } from "./tool-rack";
import { useWard, type SpectatorKind } from "./use-ward";
import type { WardVoice } from "./ward-boot";
import { WardRoster } from "./ward-roster";
import { WardWall } from "./ward-wall";

export type WardProps = {
  voice: WardVoice;
  kind: SpectatorKind;
};

const VOICE_LABEL: Record<WardVoice, string> = {
  dream: "DREAMED",
  model: "LIVE",
};

/**
 * Window content only (D5). The desktop, the menu bar and the window frame belong
 * to the shell; Ward 7 only ever fills the pane it is given.
 */
export function Ward({ voice, kind }: WardProps) {
  const { state, rows, spectators, persisted, connection } = useWard(kind);
  const alive = livingInmates(state).length;

  return (
    <div className="ward" data-voice={voice} data-connection={connection}>
      <ObserverLine state={state} spectators={spectators} connection={connection} />

      <p className="ward-voice-note">
        {voice === "dream"
          ? "NO MODEL IS ANSWERING. WARD 7 DREAMS ITS DIALOGUE FROM A SEED."
          : "A MODEL IS ANSWERING. A SOLID RAIL IS A GENERATED VOICE."}
      </p>

      <div className="ward-main">
        <section className="ward-column ward-column-left">
          <h3 className="ward-heading">
            THE WARD
            <span className="ward-heading-note">{alive} ALIVE</span>
          </h3>
          <MacScrollArea className="ward-roster-scroll" framed>
            <WardRoster state={state} />
          </MacScrollArea>
        </section>

        <section className="ward-column ward-column-right">
          <h3 className="ward-heading">
            THE WALL
            <span className="ward-heading-note ward-voice">
              <span
                className="ward-voice-swatch"
                data-voice={voice}
                aria-hidden="true"
              />
              {VOICE_LABEL[voice]}
            </span>
          </h3>
          <WardWall rows={rows} voice={voice} />
        </section>
      </div>

      <ToolRack state={state} />
      <Afterlife state={state} />

      <MacStatusBar className="ward-status">
        {ASYLUM_WARD_NAME} · BEAT {state.tick} · {alive} ALIVE ·{" "}
        {state.trash.length} IN THE TRASH ·{" "}
        {state.amputated.length === 1
          ? "1 VERB KILLED"
          : `${state.amputated.length} VERBS KILLED`}{" "}
        ·{" "}
        {persisted ? VOICE_LABEL[voice] : `${VOICE_LABEL[voice]}, NOT WRITTEN DOWN`}
      </MacStatusBar>
    </div>
  );
}
