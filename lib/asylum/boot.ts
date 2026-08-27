import "server-only";

import { liveModelsEnabled } from "@/lib/asylum/engine";
import type { ParticipantKind } from "@/lib/canvas";

export type WardVoice = "dream" | "model";

/** Structurally the `WardBoot` the shell takes; that prop stays the authority. */
export type WardBootInput = {
  open: boolean;
  voice: WardVoice;
  kind: ParticipantKind;
};

/**
 * Ward 7 is an application on the one desktop (D5), so its window exists on
 * every route and `open` only says whether the route asked for it. D9: the voice
 * is read from the environment on the server and never guessed in the browser.
 */
export function wardBoot(kind: ParticipantKind, open = false): WardBootInput {
  return { open, voice: liveModelsEnabled() ? "model" : "dream", kind };
}
