import type { Metadata } from "next";
import { headers } from "next/headers";
import { isbot } from "isbot";
import { PaintingExperience } from "@/components/painting-experience";
import { Shell } from "@/components/shell";
import { PAINT_APP } from "@/lib/apps/manifest";
import { isCanvasConfigured } from "@/lib/canvas-store";
import { shellEnabled } from "@/lib/shell/flags";

export const metadata: Metadata = {
  title: `${PAINT_APP.title} — Matias Berrios`,
  description: PAINT_APP.description,
  alternates: { canonical: PAINT_APP.route },
};

export default async function PaintPage() {
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

  return <Shell initialKind={initialKind} multiplayerEnabled={multiplayerEnabled} />;
}
