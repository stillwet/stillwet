"use client";

import { useActionState, useState } from "react";
import { redeemListingCreditGiftCode } from "@/actions/dashboard-listing-credits";
import type { UnpaidPublicationFeeListingRow } from "@/lib/listing-fee-unpaid-rows";
import {
  CREATOR_FREE_LISTINGS_MESSAGE_COUNT,
  type FreeListingRequestSlotsSummary,
} from "@/lib/marketplace-constants";
import { LISTING_CREDIT_PACKS, type ListingCreditPack } from "@/lib/listing-credit-packs";
import { ListingCreditPackPay } from "@/components/dashboard/ListingCreditPackPay";

const btnPurchaseListing =
  "inline-block rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50";

const btnPurchaseListingSelected =
  "inline-block rounded-lg border border-zinc-500/80 bg-zinc-800/70 px-4 py-2 text-sm font-medium text-zinc-200";

function FreeListingSlotsHint(props: { slots: FreeListingRequestSlotsSummary }) {
  const { slots } = props;
  if (slots.founderUnlimited) {
    return (
      <p className="mt-4 text-xs text-zinc-500">Listing publication fees are waived for your shop.</p>
    );
  }
  const available = slots.listingCreditsAvailable;
  return (
    <p className="mt-4 text-xs text-zinc-500">
      First {CREATOR_FREE_LISTINGS_MESSAGE_COUNT} listings are free. You currently have {available}{" "}
      {available === 1 ? "listing credit" : "listing credits"} available. Additional listings are
      available for purchase.
    </p>
  );
}

export function ListingCreditPackSection(props: {
  unpaidListings: UnpaidPublicationFeeListingRow[];
  freeListingSlots: FreeListingRequestSlotsSummary;
  stripePublishableKey: string | null;
  mockListingFeeCheckout: boolean;
}) {
  const { unpaidListings, freeListingSlots, stripePublishableKey, mockListingFeeCheckout } = props;

  const [payPanelPack, setPayPanelPack] = useState<ListingCreditPack | null>(null);
  const [redeemState, redeemAction, redeemPending] = useActionState(
    redeemListingCreditGiftCode,
    undefined,
  );
  const hasUnpaid = unpaidListings.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {LISTING_CREDIT_PACKS.map((pack) => (
            <li key={pack.id}>
              <button
                type="button"
                className={
                  payPanelPack?.id === pack.id ? btnPurchaseListingSelected : btnPurchaseListing
                }
                onClick={() => setPayPanelPack(pack)}
              >
                {pack.label}
              </button>
            </li>
          ))}
        </ul>
        <FreeListingSlotsHint slots={freeListingSlots} />
      </div>

      <form action={redeemAction} className="rounded-lg border border-zinc-800 bg-zinc-900/35 p-3">
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Redeem listing credit gift code
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              name="giftCode"
              autoComplete="off"
              placeholder="LIST-..."
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm uppercase tracking-[0.16em] text-zinc-100"
            />
            <button
              type="submit"
              disabled={redeemPending}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              {redeemPending ? "Redeeming…" : "Redeem"}
            </button>
          </div>
        </label>
        {redeemState?.ok ? (
          <p className="mt-2 text-xs text-emerald-300">
            Redeemed {redeemState.creditsGranted}{" "}
            {redeemState.creditsGranted === 1 ? "listing credit" : "listing credits"}.
          </p>
        ) : redeemState ? (
          <p className="mt-2 text-xs text-amber-300" role="alert">
            {redeemState.error}
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Gifted listing credit codes can be used once by one shop.
          </p>
        )}
      </form>

      {hasUnpaid ? (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
          {unpaidListings.length === 1
            ? "One listing still needs listing credits before it can move forward."
            : `${unpaidListings.length} listings still need listing credits before they can move forward.`}{" "}
          Buy a pack above to apply credits.
        </div>
      ) : null}

      {payPanelPack ? (
        <div
          id="request-listing-credit-pack-panel"
          className="rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-4"
        >
          <p className="text-sm font-medium text-zinc-200">{payPanelPack.label}</p>
          {mockListingFeeCheckout || stripePublishableKey?.trim() ? (
            <ListingCreditPackPay
              pack={payPanelPack}
              stripePublishableKey={stripePublishableKey ?? ""}
              mockListingFeeCheckout={mockListingFeeCheckout}
              onPaid={() => setPayPanelPack(null)}
            />
          ) : (
            <p className="mt-3 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
              Stripe is not configured for card payments.
            </p>
          )}
          <button
            type="button"
            className="mt-3 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
            onClick={() => setPayPanelPack(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
