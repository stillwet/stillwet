import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ADMIN_MAIN_FOOTER_CLASS, ADMIN_MAIN_SHELL_CLASS } from "@/lib/admin-layout";

export const dynamic = "force-dynamic";

export const maxDuration = 300;

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <div className={ADMIN_MAIN_SHELL_CLASS}>{children}</div>
      <div className={ADMIN_MAIN_FOOTER_CLASS}>
        <SiteLegalFooter />
      </div>
    </div>
  );
}
