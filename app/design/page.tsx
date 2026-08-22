import type { Metadata } from "next";
import { MacGallery } from "@/components/mac/gallery";

export const metadata: Metadata = {
  title: "Macintosh Component Library",
  description: "Every component in components/mac, in every state.",
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  return <MacGallery />;
}
