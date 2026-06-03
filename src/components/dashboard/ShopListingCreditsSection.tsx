"use client";

import { ListingCreditPackSection } from "@/components/dashboard/ListingCreditPackSection";
import type { UnpaidPublicationFeeListingRow } from "@/lib/listing-fee-unpaid-rows";
import type { FreeListingRequestSlotsSummary } from "@/lib/marketplace-constants";

export function ShopListingCreditsSection(props: {
  unpaidListings: UnpaidPublicationFeeListingRow[];
  freeListingSlots: FreeListingRequestSlotsSummary;
  stripePublishableKey?: string | null;
  mockListingFeeCheckout?: boolean;
  className?: string;
}) {
  const {
    unpaidListings,
    freeListingSlots,
    stripePublishableKey = null,
    mockListingFeeCheckout = false,
    className = "mt-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2 sm:p-3",
  } = props;

  return (
    <section className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Listing credits</h2>
      <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
        First 3 are free. Buy credits to publish additional listings.
      </p>
      <div className="mt-3">
        <ListingCreditPackSection
          unpaidListings={unpaidListings}
          freeListingSlots={freeListingSlots}
          stripePublishableKey={stripePublishableKey}
          mockListingFeeCheckout={mockListingFeeCheckout}
        />
      </div>
    </section>
  );
}
