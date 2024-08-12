import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "m5b6",
  description: "a page about myself",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
