import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Terms and conditions</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Platform terms for creator shops, buyers, fees, and account status.
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-zinc-400">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Shop account fees</h2>
          <p>
            Opening a creator shop requires a one-time $15 account fee unless a valid one-time setup gift code is used.
            Additional listing credits or optional shop upgrades may be purchased separately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Inactive creator accounts</h2>
          <p>
            Creator dashboard login activity is used to determine shop inactivity. If a creator account has not logged in
            for 60 days, we may send a warning email explaining that the shop may be deactivated if no login occurs within
            the next 30 days.
          </p>
          <p>
            At 90 days without a creator dashboard login, the shop account may be deactivated. The public shop and its
            listings can remain visible and available to buyers while the account is deactivated.
          </p>
          <p>
            During deactivation, 100% of proceeds from sales of that shop&apos;s listings are routed to the platform. The
            creator will not receive proceeds from purchases made while the shop is deactivated.
          </p>
          <p>
            A deactivated creator shop can be reactivated by signing in and paying a one-time $5 reactivation fee. After
            reactivation, normal dashboard access and normal proceeds routing resume for future sales.
          </p>
          <p>
            If a shop remains deactivated for one year and has no sales during that deactivation period, the platform may
            begin the shop account deletion process without additional creator confirmation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Purchases and fulfillment</h2>
          <p>
            Listings are print on demand. Item printing, shipping, and related fulfillment are coordinated by the platform
            and fulfillment partners.
          </p>
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
