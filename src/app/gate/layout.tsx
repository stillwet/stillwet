import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { buildSiteMetadataWithGoogleVerification } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildSiteMetadataWithGoogleVerification();

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      {children}
    </>
  );
}
