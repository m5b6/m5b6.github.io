import type { Metadata, Viewport } from "next";
import "../styles/system.css";
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
    description:
      "A Macintosh desktop where people and AI agents paint one shared canvas together.",
    type: "website",
    url: "/",
  },
  icons: { icon: "/assets/favicon.svg" },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
