import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";

export function TermsConditionsContent() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-50">Terms and Conditions</h1>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-zinc-400">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Shop account fees</h2>
          <p>
            Opening a creator shop requires a one-time $15 account fee unless a valid one-time setup gift code is used.
            Shop account fees are non-refundable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Sale proceeds and fees</h2>
          <p>
            When a buyer purchases merchandise from a shop, the creator does not receive the full sale price. Proceeds
            are calculated as follows. Goods and services costs are
            deducted first. Goods and services include but not limited to: raw item cost, printing, order fulfillment,
            shipping, and related production expenses. The platform then collects a fee of 10% on the remaining amount.
            The creator receives the remaining balance after those deductions.
          </p>
          <p>
            Buyers may optionally add a cart tip at checkout. When a tip is included, the platform retains a $0.25 tip
            processing fee; the remainder of the tip goes to the creator shop.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Shop regulations</h2>
          <p>
            Items that go against shop regulations will be promptly rejected/removed. Creators must follow these
            guidelines for every listing. See also the{" "}
            <a href="/shop-regulations" className="text-blue-400/90 underline-offset-2 hover:text-blue-300 hover:underline">
              shop regulations
            </a>{" "}
            page.
          </p>
          <ItemGuidelinesArticle className="space-y-4 text-sm leading-relaxed text-zinc-400" />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Inactive creator accounts</h2>
          <p>
            Creator login activity is used to determine shop inactivity. If a creator account has not logged in for 30
            days, we may send a warning email explaining that the shop may be deactivated. If no login occurs within the
            next 30 days, the shop account is deactivated (60 days without login).
          </p>
          <p>
            When a shop is deactivated for inactivity, the public shop and its listings remain visible on marketplace
            browse pages (including All shops and All items). The platform may keep some or all listings available for
            purchase while the account is deactivated; administrators may choose which items stay live on a deactivated
            shop.
          </p>
          <p>
            During deactivation, any sales made will go 100% to the platform. The creator will not receive proceeds from
            purchases made while the shop is deactivated.
          </p>
          <p>
            A deactivated shop may be reactivated by signing in and paying a one-time $5 reactivation fee within 30 days
            of deactivation (90 days from the inactivity warning email). After reactivation, normal dashboard access and
            normal proceeds routing resume for future sales.
          </p>
          <p>
            If the reactivation window expires without payment, the platform may mark the account as abandoned or close
            it altogether. In an abandoned state, the platform takes full ownership of existing listings and sale
            proceeds. When a shop is abandoned or closed, the email address associated with the account is removed from
            the shop and may be used to create a new shop account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Purchases and fulfillment</h2>
          <p>
            Listings are print on demand. Item printing, shipping, and related fulfillment are coordinated by the platform
            and fulfillment partners.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Changes to terms and conditions</h2>
          <p>
            Fees are subject to change at any time. Terms and conditions can change at any time. If terms and conditions
            change, updated terms and conditions will be sent for agreement.
          </p>
        </section>
      </div>
    </>
  );
}
