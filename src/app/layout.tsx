import type { Metadata } from "next";
import { Source_Sans_3, Source_Code_Pro } from "next/font/google";
import { MobileTestViewportShell } from "@/components/MobileTestViewportShell";
import { MobileTestViewportSync } from "@/components/MobileTestViewportSync";
import { buildRootSiteMetadata } from "@/lib/site-metadata";
import "./globals.css";

/* Dimension (html5up.net/dimension) uses Source Sans Pro; Source Sans 3 is the maintained successor. */
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const sourceCode = Source_Code_Pro({
  variable: "--font-source-code",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = buildRootSiteMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${sourceCode.variable} ${sourceSans.className} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 font-sans text-zinc-100">
        <MobileTestViewportSync />
        <MobileTestViewportShell />
        {children}
      </body>
    </html>
  );
}
