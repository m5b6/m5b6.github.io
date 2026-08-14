import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://matiasberrios.com",
  ),
  title: "Matias Berrios",
  description: "Matias Berrios is an engineer and founder from Chile.",
  authors: [{ name: "Matias Berrios" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Matias Berrios",
    description: "A multiplayer homepage where people and AI agents paint together.",
    type: "website",
    url: "/",
  },
  icons: { icon: "/assets/favicon.svg" },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
