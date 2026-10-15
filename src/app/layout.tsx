
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AKNM OS | Founder Operating System",
    template: "%s | AKNM OS",
  },
  description:
    "A personal operating system for planning, ventures, finances, assets, and achievements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
