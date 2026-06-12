"use client";

import { useEffect, useRef, useState } from "react";
import type { UnpaidPublicationFeeListingRow } from "@/lib/listing-fee-unpaid-rows";
import type { FreeListingRequestSlotsSummary } from "@/lib/marketplace-constants";
import { LISTING_CREDIT_PACKS, type ListingCreditPack } from "@/lib/listing-credit-packs";
import { ListingCreditPackPay } from "@/components/dashboard/ListingCreditPackPay";

const btnPurchaseListing =
  "block w-full rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2.5 py-1 text-center text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

const btnPurchaseListingSelected =
  "block w-full rounded-md border border-zinc-500/80 bg-zinc-800/70 px-2.5 py-1 text-center text-[11px] font-medium text-zinc-100";

const btnPurchaseListingEmphasized =
  "block w-full rounded-md border border-blue-500/70 bg-blue-950/50 px-2.5 py-1 text-center text-[11px] font-medium text-blue-200 transition-colors hover:border-blue-400/80 hover:bg-blue-950/70 hover:text-blue-100";

const btnPurchaseListingEmphasizedSelected =
  "block w-full rounded-md border border-blue-400/90 bg-blue-900/60 px-2.5 py-1 text-center text-[11px] font-medium text-blue-100";

function packLabelParts(label: string): { creditsLine: string; priceLine: string } {
  const sep = label.indexOf(" — ");
  if (sep === -1) return { creditsLine: label, priceLine: "" };
  return { creditsLine: label.slice(0, sep), priceLine: label.slice(sep + 3) };
}

function FreeListingSlotsHint(props: { slots: FreeListingRequestSlotsSummary }) {
  const { slots } = props;
  if (slots.founderUnlimited) {
    return (
      <p className="mt-2 text-xs text-zinc-500">Listing credits are not required for your shop.</p>
    );
  }
  const available = slots.listingCreditsAvailable;
  return (
    <p className="mt-2 text-xs text-zinc-500">
      You currently have {available} {available === 1 ? "listing credit" : "listing credits"} available.
    </p>
  );
}

export function ListingCreditPackSection(props: {
  unpaidListings: UnpaidPublicationFeeListingRow[];
  freeListingSlots: FreeListingRequestSlotsSummary;
  stripePublishableKey: string | null;
  mockListingFeeCheckout: boolean;
  /** Blue pack buttons when the shop must buy credits before requesting another listing. */
  emphasizePurchasePacks?: boolean;
}) {
  const {
    unpaidListings,
    freeListingSlots,
    stripePublishableKey,
    mockListingFeeCheckout,
    emphasizePurchasePacks = false,
  } = props;

  const [payPanelPack, setPayPanelPack] = useState<ListingCreditPack | null>(null);
  const packsContainerRef = useRef<HTMLDivElement>(null);
  const packsMeasureRef = useRef<HTMLUListElement>(null);
  const [packsCompact, setPacksCompact] = useState(false);
  const hasUnpaid = unpaidListings.length > 0;

  useEffect(() => {
    const container = packsContainerRef.current;
    const measure = packsMeasureRef.current;
    if (!container || !measure) return;

    const updateLayout = () => {
      const available = container.clientWidth;
      const needed = measure.scrollWidth;
      setPacksCompact(needed > Math.max(0, available - 8));
    };

    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [payPanelPack?.id]);

  const renderPackButtons = (compact: boolean, forMeasure = false) =>
    LISTING_CREDIT_PACKS.map((pack) => {
      const selected = payPanelPack?.id === pack.id;
      const { creditsLine, priceLine } = packLabelParts(pack.label);
      const btnClass = emphasizePurchasePacks
        ? compact
          ? selected
            ? "block w-full rounded-md border border-blue-400/90 bg-blue-900/60 px-2 py-1 text-center text-[11px] font-medium leading-tight text-blue-100"
            : "block w-full rounded-md border border-blue-500/70 bg-blue-950/50 px-2 py-1 text-center text-[11px] font-medium leading-tight text-blue-200 transition-colors hover:border-blue-400/80 hover:bg-blue-950/70 hover:text-blue-100"
          : selected
            ? btnPurchaseListingEmphasizedSelected
            : btnPurchaseListingEmphasized
        : compact
          ? selected
            ? "block w-full rounded-md border border-zinc-500/80 bg-zinc-800/70 px-2 py-1 text-center text-[11px] font-medium leading-tight text-zinc-100"
            : "block w-full rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-1 text-center text-[11px] font-medium leading-tight text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100"
          : selected
            ? btnPurchaseListingSelected
            : btnPurchaseListing;
      return (
        <li key={pack.id} className={forMeasure ? "shrink-0" : "min-w-0 flex-1"}>
          <button type="button" className={btnClass} onClick={() => setPayPanelPack(pack)}>
            {compact ? (
              <>
                <span className="block whitespace-nowrap">{creditsLine}</span>
                {priceLine ? <span className="block whitespace-nowrap">{priceLine}</span> : null}
              </>
            ) : (
              pack.label
            )}
          </button>
        </li>
      );
    });

  return (
    <div className="space-y-4">
      <div>
        <div ref={packsContainerRef} className="relative w-full min-w-0">
          <ul
            ref={packsMeasureRef}
            className="pointer-events-none invisible absolute left-0 top-0 flex h-0 w-max list-none flex-nowrap gap-1.5 overflow-hidden p-0"
            aria-hidden
          >
            {renderPackButtons(false, true)}
          </ul>
          <ul className="flex w-full min-w-0 list-none flex-nowrap items-stretch gap-1.5 p-0">
            {renderPackButtons(packsCompact)}
          </ul>
        </div>
        {emphasizePurchasePacks ? (
          <p className="mt-2 text-xs text-blue-200/90">
            Buy listing credits to unlock a new request.
          </p>
        ) : (
          <FreeListingSlotsHint slots={freeListingSlots} />
        )}
      </div>

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
          className="rounded-lg border border-zinc-800/90 bg-zinc-900/35 p-3"
        >
          {mockListingFeeCheckout || stripePublishableKey?.trim() ? (
            mockListingFeeCheckout ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-xs font-medium text-zinc-200">{payPanelPack.label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ListingCreditPackPay
                    pack={payPanelPack}
                    stripePublishableKey={stripePublishableKey ?? ""}
                    mockListingFeeCheckout={mockListingFeeCheckout}
                    inline
                    onPaid={() => setPayPanelPack(null)}
                  />
                  <button
                    type="button"
                    className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
                    onClick={() => setPayPanelPack(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-zinc-200">{payPanelPack.label}</p>
                <ListingCreditPackPay
                  pack={payPanelPack}
                  stripePublishableKey={stripePublishableKey ?? ""}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                  onPaid={() => setPayPanelPack(null)}
                />
                <button
                  type="button"
                  className="mt-1.5 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
                  onClick={() => setPayPanelPack(null)}
                >
                  Cancel
                </button>
              </>
            )
          ) : (
            <>
              <p className="text-xs font-medium text-zinc-200">{payPanelPack.label}</p>
              <p className="mt-2 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-1.5 text-xs text-amber-200/90">
                Stripe is not configured for card payments.
              </p>
              <button
                type="button"
                className="mt-1.5 text-xs text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
                onClick={() => setPayPanelPack(null)}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
