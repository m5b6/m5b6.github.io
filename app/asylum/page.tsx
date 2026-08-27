import type { Metadata } from "next";
import { headers } from "next/headers";
import { isbot } from "isbot";
import { PaintingExperience } from "@/components/painting-experience";
import { Shell } from "@/components/shell";
import { ASYLUM_APP } from "@/lib/apps/manifest";
import { wardBoot } from "@/lib/asylum/boot";
import { resolveCopy } from "@/lib/apps/facts";
import { isCanvasConfigured } from "@/lib/canvas-store";
import { shellEnabled } from "@/lib/shell/flags";

/** Never prerendered: the ward is read at request time or not at all. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${ASYLUM_APP.title} — Matias Berrios`,
  description: resolveCopy(ASYLUM_APP.description),
  alternates: { canonical: ASYLUM_APP.route },
};

export default async function AsylumPage() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const initialKind = isbot(userAgent) ? "agent" : "human";
  const multiplayerEnabled = isCanvasConfigured();

  if (!shellEnabled()) {
    return (
      <PaintingExperience
        initialKind={initialKind}
        multiplayerEnabled={multiplayerEnabled}
      />
    );
  }

  return (
    <Shell
      initialKind={initialKind}
      multiplayerEnabled={multiplayerEnabled}
      ward={wardBoot(initialKind, true)}
    />
  );
}
