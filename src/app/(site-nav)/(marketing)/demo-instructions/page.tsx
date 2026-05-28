import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { BRAND_NAME } from "@/lib/site-brand";

const DEMO_SURVEY_URL = "https://www.jotform.com/form/261326846259061";

export default function DemoInstructionsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="store-kicker text-blue-300/80">Beta testing</p>
      <h1 className="mt-3 text-3xl font-semibold text-zinc-50">Tester instructions</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">
        Thank you for helping test {BRAND_NAME} before launch.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Please use your demo coupon code to sign up for a creator account, then follow the onboarding instructions
        in your shop dashboard.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-400">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100">1. Create your demo shop</h2>
          <p className="mt-3">
            Go to the shop signup page, enter your shop details, and apply your demo coupon code during signup.
            After your account is created, continue through the dashboard onboarding steps.
          </p>
          <Link
            href="/create-shop"
            className="mt-5 inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            Sign up for a shop
          </Link>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <h2 className="text-base font-semibold text-zinc-100">2. Remember this is demo-only</h2>
          <p className="mt-3">
            The website is currently in beta testing. Payments are demos right now, so no actual sales are
            possible until the site goes live later this year.
          </p>
          <p className="mt-3">
            An announcement will be sent when real sales and live payments are available.
          </p>
        </section>

        <section className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5">
          <h2 className="text-base font-semibold text-blue-100">3. Fill out the tester survey</h2>
          <p className="mt-3 text-blue-100/85">
            When you finish testing signup, onboarding, shop setup, listings, and browsing, please complete the
            tester survey.
          </p>
          <a
            href={DEMO_SURVEY_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex rounded-xl bg-blue-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            Open tester survey
          </a>
        </section>
      </div>

      <p className="mt-12">
        <Link href="/" className="text-sm text-blue-400/90 hover:underline">
          ← Home
        </Link>
      </p>
      <SiteLegalFooter />
    </main>
  );
}
