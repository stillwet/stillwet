import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { dashQueryParamForTabId } from "@/lib/dashboard-dash-query";
import { BRAND_NAME } from "@/lib/site-brand";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import { shopFlairAccessPriceUsdLabel } from "@/lib/shop-flair";

const DEMO_SURVEY_URL = "https://www.jotform.com/form/261326846259061";

/** Reads shop-owner session cookies for the support link — cannot be statically generated. */
export const dynamic = "force-dynamic";

export default async function DemoInstructionsPage() {
  const owner = await getShopOwnerSessionReadonly();
  const isLoggedIn = Boolean(owner.shopUserId);
  const supportDashboardHref = `/dashboard?dash=${encodeURIComponent(dashQueryParamForTabId("support"))}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <p className="store-kicker text-blue-300/80">Beta testing</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Tester Instructions</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Thank you for helping test {BRAND_NAME} before launch.
      </p>

      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-400">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100">1. Create shop + follow onboarding</h2>
          <p className="mt-3">
            Sign up for a shop with your coupon code. Complete the shop onboarding.
          </p>
          <Link
            href="/create-shop"
            className="mt-5 inline-flex rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-white"
          >
            Sign up for a shop
          </Link>
        </section>

        <section className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5">
          <h2 className="text-base font-semibold text-blue-100">2. Fill out the tester survey</h2>
          <div className="mt-3 space-y-0.5 text-blue-100/85">
            <p>Testing is not complete until you fill out the survey.</p>
            <p>
              If you don&apos;t complete testing before beta testing closes, you will not receive testing
              promotions.
            </p>
          </div>
          <a
            href={DEMO_SURVEY_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-white"
          >
            Open tester survey
          </a>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100">Additional Info</h2>
          <ul className="mt-3 list-disc space-y-4 pl-5">
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Testers receive
              </span>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Shop setup fee waived ($15)</li>
                <li>5 free listings ($5)</li>
                <li>Free shop flair ({shopFlairAccessPriceUsdLabel().replace(".00", "")})</li>
                <li className="-ml-5 list-none italic text-zinc-500">
                  Testers who do not complete onboarding /survey by due date will have promotions
                  revoked.
                </li>
              </ul>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Not live yet
              </span>
              <p className="mt-2">
                The website is in beta testing, so no item sales are possible at this time. The site will go
                live later this year, at which time your listings can be bought for real money.
              </p>
              <p className="mt-2">
                An announcement will be sent when real sales and live payments are available.
              </p>
            </li>
            <li>
              <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Need help?
              </span>
              <p className="mt-2">
                {isLoggedIn ? (
                  <>
                    Start a{" "}
                    <Link href={supportDashboardHref} className="text-blue-400/90 hover:underline">
                      support chat
                    </Link>{" "}
                    via your shop dashboard
                  </>
                ) : (
                  <Link href="/dashboard/login" className="text-blue-400/90 hover:underline">
                    Log in to access shop dashboard
                  </Link>
                )}
              </p>
            </li>
          </ul>
        </section>
      </div>

      <SiteLegalFooter />
    </main>
  );
}
