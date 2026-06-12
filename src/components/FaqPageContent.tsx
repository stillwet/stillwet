"use client";

import Link from "next/link";
import { useState } from "react";
import { SupportSiteCta } from "@/components/SupportSiteCta";

const FAQ_SUPPORT_SITE_LINK_CLASS =
  "store-dimension-brand inline cursor-pointer border-0 bg-transparent p-0 font-normal text-blue-400/90 underline decoration-blue-500/40 underline-offset-[3px] transition hover:text-blue-300 hover:decoration-blue-400/60";

type FaqAudience = "buyer" | "seller";
type FaqCategory = "both" | FaqAudience;

type FaqItem = {
  id: string;
  category: FaqCategory;
  content: React.ReactNode;
};

function faqVisibleForAudience(category: FaqCategory, audience: FaqAudience): boolean {
  return category === "both" || category === audience;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "buyer-privacy",
    category: "buyer",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">
          Can shop owners see my name / address when I purchase an item?
        </h2>
        <p>
          No, shop owners only see that an item has been purchased.
          <br />
          They can <strong>not</strong> see any personal details such as email, name, address, etc.
        </p>
      </>
    ),
  },
  {
    id: "shipping",
    category: "buyer",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">Where do you ship?</h2>
        <p>
          Currently, we can only ship to the US. We are actively trying to expand into other countries.
        </p>
      </>
    ),
  },
  {
    id: "shop-outside-us",
    category: "seller",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">
          Can I open a shop if I live outside of the U.S.?
        </h2>
        <p>
          Currently, we can only support payouts to U.S. bank accounts, but are actively trying to expand into
          other countries. Consider{" "}
          <SupportSiteCta className={FAQ_SUPPORT_SITE_LINK_CLASS}>supporting the site</SupportSiteCta> to vote
          for your country.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    category: "seller",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">
          What does it cost to have a shop? / What fees do you collect?
        </h2>
        <p>
          <strong className="font-semibold text-zinc-200">Opening a shop has a one-time $15 account fee.</strong>
          <br />
          Each shop gets 3 free listings. Additional listings are available for purchase.
        </p>
        <p>
          When you sell an item, you don&apos;t get the full purchase amount. The platform deducts production costs,
          then a 10% platform fee of the remaining amount. See{" "}
          <Link href="/terms" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
            Terms
          </Link>
          . You can see your estimated profit when you set the sales price in your listing.
        </p>
      </>
    ),
  },
  {
    id: "sell",
    category: "seller",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">How do I sell my items?</h2>
        <p>
          Create an account and request a listing. You&apos;ll select what kind of product you&apos;ll sell, name the
          product, item price, and upload your design for review. If your design is within regulations, it will be
          approved and available for purchase in your shop. That&apos;s it! We take care of the rest.
        </p>
      </>
    ),
  },
  {
    id: "paid",
    category: "seller",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">How do I get paid?</h2>
        <p>
          We use Stripe Connect for sales payouts. See{" "}
          <Link href="/terms" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
            Terms
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "fulfillment-buyer",
    category: "buyer",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">How does fulfillment work?</h2>
        <p>
          Listings are print on demand. After an order is placed, item printing and shipping are coordinated by the
          platform and fulfillment partners. Shop account holders are not part of order fulfillment.
        </p>
      </>
    ),
  },
  {
    id: "fulfillment-seller",
    category: "seller",
    content: (
      <>
        <h2 className="text-base font-semibold text-zinc-200">How does fulfillment work?</h2>
        <p>
          Listings are print on demand. After an order is placed, item printing and shipping are coordinated by the
          platform and fulfillment partners. Shop account holders are not part of order fulfillment. We take care of
          logistics for you, so you can stay focused on creating.
        </p>
      </>
    ),
  },
  {
    id: "returns",
    category: "buyer",
    content: (
      <>
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
          </li>
        </ul>
      </>
    ),
  },
];

function faqAudienceBtnClass(active: boolean): string {
  return `store-kicker rounded border px-2.5 py-1 transition ${
    active
      ? "border-zinc-500 text-zinc-400"
      : "border-zinc-700 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400"
  }`;
}

export function FaqPageContent() {
  const [audience, setAudience] = useState<FaqAudience>("buyer");
  const visibleItems = FAQ_ITEMS.filter((item) => faqVisibleForAudience(item.category, audience));

  return (
    <>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2" aria-label="FAQ audience">
        <button
          type="button"
          aria-pressed={audience === "buyer"}
          className={faqAudienceBtnClass(audience === "buyer")}
          onClick={() => setAudience("buyer")}
        >
          Buyer
        </button>
        <button
          type="button"
          aria-pressed={audience === "seller"}
          className={faqAudienceBtnClass(audience === "seller")}
          onClick={() => setAudience("seller")}
        >
          Seller
        </button>
      </nav>

      <div className="mt-4 space-y-10 text-sm leading-relaxed text-zinc-400">
        {visibleItems.map((item) => (
          <section key={item.id} className="space-y-3">
            {item.content}
          </section>
        ))}
      </div>
    </>
  );
}
