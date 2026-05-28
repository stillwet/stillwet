import Link from "next/link";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Frequently asked questions</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Quick answers about shipping, accounts, and how this marketplace works.
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-zinc-400">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Where do you ship?</h2>
          <p>
            Currently, we can only ship to the US.{" "}
            <span className="text-zinc-500">We are actively trying to expand into other countries.</span> Because of
            this, all prices use United States Dollar (USD) currency.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">
            What does it cost to have a shop? / What fees do you collect?
          </h2>
          <p>
            <strong className="font-semibold text-zinc-200">Opening a shop has a one-time $15 account fee.</strong> When
            you pay by card, an estimated card processing fee is added at Stripe checkout. Each shop gets 3 free
            listings. Additional listings are available for purchase.
          </p>
          <p>When you sell an item, you don&apos;t get the full purchase amount.</p>
          <p>
            The platform first deducts the cost of goods, printing services, and shipping, then a 10% platform fee of the
            remaining amount.
          </p>
          <p>You can see your estimated profit when you set the sales price in your listing.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">What happens if I stop logging in?</h2>
          <p>
            If a creator does not log in for 60 days, we may send a warning email. At 90 days inactive, the shop account
            can be deactivated and later reactivated with a one-time $5 fee.
          </p>
          <p>
            Deactivated shops may stay available to buyers, but proceeds from sales while deactivated go 100% to the
            platform. See the{" "}
            <Link href="/terms" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
              terms
            </Link>{" "}
            for details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">How do I sell my items?</h2>
          <p>
            Create an account and request a listing. You&apos;ll select what kind of product you&apos;ll sell, name the
            product, item price, and upload your design for review. If your design is within regulations, it will be approved and
            available for purchase in your shop. That&apos;s it! We take care of the rest.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">How do I get paid?</h2>
          <p>
            We use Stripe for sales payouts and for collecting any optional shop upgrade purchases.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">How does fulfillment work?</h2>
          <p>
            Listings are print on demand. After an order is placed, item printing and shipping are coordinated by the
            platform and fulfillment partners. Shop account holders are not part of order fulfillment.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Returns, privacy, and support</h2>
          <ul className="list-inside list-disc space-y-2 pl-1">
            <li>
              <Link href="/returns" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
                Returns &amp; refunds
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
                Privacy policy
              </Link>
              .
            </li>
            <li>
              <Link href="/terms" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
                Terms and conditions
              </Link>
              .
            </li>
          </ul>
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
