import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { googleSiteVerificationMetadata } from "@/lib/google-site-verification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = googleSiteVerificationMetadata;

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
