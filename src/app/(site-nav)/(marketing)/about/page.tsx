import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { SupportSiteCta } from "@/components/SupportSiteCta";
import { BRAND_NAME } from "@/lib/site-brand";
import { isSupportCheckoutConfigured } from "@/lib/support-site";

export default function AboutPage() {
  const supportAvailable = isSupportCheckoutConfigured();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">About</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
        <p className="font-semibold text-zinc-100">
          We handle printing and shipping logistics for creator-designed merchandise.
        </p>
        <p>
          {BRAND_NAME} is a multi-vendor marketplace built on a shared catalog and unified fulfillment.
          Independent creators operate their own storefronts while checkout, order fulfillment, and
          operations are handled by the platform. This keeps the checkout experience safe and consistent for
          buyers. All shop items are print on demand.
        </p>
        <p>{BRAND_NAME} is a small women-owned business, not a giant software company.</p>
        <p>
          Please consider{" "}
          {supportAvailable ? (
            <SupportSiteCta
              className="store-dimension-brand inline cursor-pointer border-0 bg-transparent p-0 font-normal text-blue-400/90 underline decoration-blue-500/40 underline-offset-[3px] transition hover:text-blue-300 hover:decoration-blue-400/60"
            >
              supporting the site
            </SupportSiteCta>
          ) : (
            "supporting the site"
          )}
          , so we can continue expanding site features and countries we can ship to.
        </p>
      </div>
      <p className="mt-10">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
