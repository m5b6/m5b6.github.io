import { headers } from "next/headers";
import { isbot } from "isbot";
import { PaintingExperience } from "@/components/painting-experience";
import { isCanvasConfigured } from "@/lib/canvas-store";

export default async function Home() {
  const userAgent = (await headers()).get("user-agent") ?? "";

  return (
    <PaintingExperience
      initialKind={isbot(userAgent) ? "agent" : "human"}
      multiplayerEnabled={isCanvasConfigured()}
    />
  );
}
