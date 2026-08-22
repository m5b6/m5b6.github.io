import { headers } from "next/headers";
import { isbot } from "isbot";
import { PaintingExperience } from "@/components/painting-experience";
import { Shell } from "@/components/shell";
import { isCanvasConfigured } from "@/lib/canvas-store";
import { shellEnabled } from "@/lib/shell/flags";

export default async function Home() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const initialKind = isbot(userAgent) ? "agent" : "human";
  const multiplayerEnabled = isCanvasConfigured();

  // SHELL_ENABLED=0 is the rollback path: the pre-desktop page, unchanged.
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
