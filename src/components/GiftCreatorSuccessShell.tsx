import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { GiftCreatorSuccessConfetti } from "@/components/GiftCreatorSuccessConfetti";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";

const HOME_HREF = "/";
const HOME_CTA_CLASS =
  "mt-8 inline-block rounded-xl bg-blue-900/90 px-6 py-3 text-sm font-medium text-white hover:bg-blue-800";

export function GiftCreatorSuccessHomeLink({ label = "Return home" }: { label?: string }) {
  return (
    <Link href={HOME_HREF} className={HOME_CTA_CLASS}>
      {label}
    </Link>
  );
}

export function GiftCreatorSuccessShell({
  title = "Thank you",
  showConfetti = false,
  children,
}: {
  title?: string;
  showConfetti?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="store-dimension-bg">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <div className="mx-auto max-w-[1124px] px-4 py-8 sm:px-6 sm:py-10">
        <StoreDocumentPanel
          backHref={HOME_HREF}
          backLabel="Return home"
          showBackLink={false}
          closeHref={HOME_HREF}
          title={title}
        >
          <div className="text-center">
            {showConfetti ? <GiftCreatorSuccessConfetti /> : null}
            {children}
          </div>
        </StoreDocumentPanel>
      </div>
      <div className="mx-auto max-w-[1124px] px-4 pb-10 sm:px-6">
        <SiteLegalFooter />
      </div>
    </div>
  );
}
