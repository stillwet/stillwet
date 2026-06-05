"use client";

import type { ReactNode } from "react";
import type { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";
import { dashQueryParamForTabId } from "@/lib/dashboard-dash-query";
import { useDashboardTabFetch, type DashboardTabLoadedFlags } from "@/components/dashboard/useDashboardTabFetch";
import {
  DASHBOARD_PROMOTIONS_PATH,
  DASHBOARD_SHOP_UPGRADES_LABEL,
} from "@/lib/dashboard-promotions-path";
import type { DashboardSupportChatPayload } from "@/lib/dashboard-scoped-data";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  dashboardCreatorRemoveListingFromShop,
  dashboardPayListingFee,
} from "@/actions/dashboard-marketplace";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
  listingFeeFreeSlotCap,
} from "@/lib/marketplace-constants";
import { navTabCountBadgeCircleClass } from "@/lib/nav-tab-count-badge";
import type { UnpaidPublicationFeeListingRow } from "@/lib/listing-fee-unpaid-rows";
import type { FreeListingRequestSlotsSummary } from "@/lib/marketplace-constants";
import {
  DashboardListingItemNameForm,
  DashboardListingStorefrontBlurbForm,
  DashboardListingSearchKeywordsForm,
  DashboardListingPriceForm,
  DashboardListingSupplementPhotoForm,
  DashboardSubmitListingRequestForm,
  ListingEmbeddedSupplementCatalogPair,
  ListingStorefrontCatalogImagesForms,
  PaidOrderShopProfitHelp,
} from "@/components/dashboard/DashboardListingForms";
import type { ShopSetupShopPayload, ShopSetupSteps } from "@/components/dashboard/ShopSetupTabs";
import type { DashboardShopAccountPayload } from "@/components/dashboard/DashboardShopAccountPanel";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import {
  dashboardSetupTabsKey,
  onboardingSetupAfterGuidelinesAcknowledged,
  onboardingSetupAfterListingSubmitted,
} from "@/lib/shop-onboarding-gate";
import { DashboardNoticeMarkReadForm } from "@/components/dashboard/DashboardNoticeMarkReadForm";
import { DashboardNoticeBody } from "@/components/dashboard/DashboardNoticeBody";
import { dashboardListingMinPriceHintCents } from "@/lib/listing-cart-price";
import { formatDisplayedDateTime } from "@/lib/format-display-datetime";
import {
  parseListingStorefrontCatalogImageSelection,
  productImageUrlsUnionHero,
  productPrimaryImageForShopListing,
} from "@/lib/product-media";
import type { GroupedDashboardListing } from "@/lib/dashboard-legacy-baseline-listing-groups";
import { ListingsTabExpandSection } from "@/components/dashboard/ListingsTabExpandSection";
const DASHBOARD_NOTIFICATIONS_PAGE_SIZE = 10;

const ShopSetupTabsLazy = nextDynamic(
  () => import("@/components/dashboard/ShopSetupTabs").then((m) => ({ default: m.ShopSetupTabs })),
  { ssr: true },
);
const ShopProfileSetupPanelLazy = nextDynamic(
  () =>
    import("@/components/dashboard/ShopProfileSetupPanel").then((m) => ({ default: m.ShopProfileSetupPanel })),
  { ssr: true },
);
const ShopItemGuidelinesPanelLazy = nextDynamic(
  () =>
    import("@/components/dashboard/ShopItemGuidelinesPanel").then((m) => ({ default: m.ShopItemGuidelinesPanel })),
  { ssr: true },
);
const ShopFirstListingRequestPanelLazy = nextDynamic(
  () =>
    import("@/components/dashboard/ShopFirstListingRequestPanel").then((m) => ({
      default: m.ShopFirstListingRequestPanel,
    })),
  { ssr: true },
);
const BugFeedbackPanelLazy = nextDynamic(
  () => import("@/components/dashboard/BugFeedbackPanel").then((m) => ({ default: m.BugFeedbackPanel })),
  { ssr: true },
);
const DashboardShopAccountPanelLazy = nextDynamic(
  () =>
    import("@/components/dashboard/DashboardShopAccountPanel").then((m) => ({
      default: m.DashboardShopAccountPanel,
    })),
  { ssr: true },
);
const DashboardSupportChatPanelLazy = nextDynamic(
  () =>
    import("@/components/dashboard/DashboardSupportChatPanel").then((m) => ({
      default: m.DashboardSupportChatPanel,
    })),
  { ssr: true },
);
const DemoShopPurchaseButtonLazy = nextDynamic(
  () =>
    import("@/components/dashboard/DemoShopPurchaseButton").then((m) => ({
      default: m.DemoShopPurchaseButton,
    })),
  { ssr: true },
);

export type DashboardSetupPanelProps = {
  setupTabsKey: string;
  shop: ShopSetupShopPayload;
  itemGuidelinesAcknowledged: boolean;
  catalogGroups: ShopSetupCatalogGroup[];
  steps: ShopSetupSteps;
  incompleteSetupCount: number;
  r2Configured: boolean;
  listingPickerDiagnostics?: { adminCatalogItemCount: number };
  /** When the next listing request needs a listing credit from the bonus pool. */
  needsListingCreditForNextRequest: boolean;
  /** Legacy — listing credits and upgrades are not gated on Connect readiness. */
  stripeConnectReadyForPaidListings: boolean;
  /** Listings that owe a paid publication fee (shown on Request listing tab). */
  unpaidPublicationFeeListings: UnpaidPublicationFeeListingRow[];
  freeListingSlots: FreeListingRequestSlotsSummary;
};

export type DashboardListingRow = {
  id: string;
  active: boolean;
  requestStatus: ListingRequestStatus;
  priceCents: number;
  requestImages: unknown;
  /** Optional admin-set second storefront image (approved listings). */
  adminListingSecondaryImageUrl: string | null;
  /** Optional extra image on the public storefront (approved listings). */
  ownerSupplementImageUrl: string | null;
  /** Custom image awaiting admin approval (not public until promoted). */
  ownerSupplementPendingImageUrl: string | null;
  /** ISO timestamp when pending supplement was submitted. */
  ownerSupplementPendingSubmittedAtIso: string | null;
  /** Shop label for this listing request (optional). */
  requestItemName: string | null;
  /** Optional one-line pitch on the public PDP (`ShopListing.storefrontItemBlurb`). */
  storefrontItemBlurb: string | null;
  /** Optional shop search hints (`ShopListing.listingSearchKeywords`). */
  listingSearchKeywords: string | null;
  listingFeePaidAt: string | null;
  adminRemovedFromShopAt: string | null;
  creatorRemovedFromShopAt: string | null;
  /** 1-based order by shop creation time (oldest = 1). */
  listingOrdinal: number;
  /** ISO timestamp — used for “Submitted MM/DD” and similar display. */
  updatedAtIso: string;
  /** Extracted from the newest `listing_rejected` notice when status is rejected. */
  rejectionReasonText: string | null;
  /** JSON string[] or null — which catalog URLs show on the public PDP. */
  listingStorefrontCatalogImageUrls: unknown;
  baselineCatalogPickEncoded: string | null;
  /** Unit goods/services COGS (admin baseline); used for estimated shop profit at list price. */
  goodsServicesUnitCents: number;
  listingPrintifyVariantId: string | null;
  product: {
    name: string;
    slug: string;
    /** Catalog row — storefront and marketplace browse require this true. */
    active: boolean;
    minPriceCents: number;
    priceCents: number;
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
    fulfillmentType: FulfillmentType;
    printifyVariantId: string | null;
  };
};

export type DashboardPaidOrderRow = {
  id: string;
  createdAt: string;
  lines: Array<{
    lineDisplayLabel: string;
    quantity: number;
    unitPriceCents: number;
    goodsServicesCostCents: number;
    platformCutCents: number;
    shopCutCents: number;
  }>;
};

export type DashboardNoticeRow = {
  id: string;
  body: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
};

function formatNoticeWhen(iso: string) {
  const s = formatDisplayedDateTime(iso);
  return s === "—" ? iso : s;
}

/** Paid order timestamps from the server are ISO UTC; show calendar date only as MM/DD/YY. */
function formatPaidOrderDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch {
    return iso;
  }
}

function paidOrderDateTimeAttr(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function paidOrderMerchandiseTotals(o: DashboardPaidOrderRow) {
  return o.lines.reduce(
    (acc, l) => ({
      saleCents: acc.saleCents + l.unitPriceCents * l.quantity,
      goodsServicesCostCents: acc.goodsServicesCostCents + l.goodsServicesCostCents,
      platformCutCents: acc.platformCutCents + l.platformCutCents,
    }),
    { saleCents: 0, goodsServicesCostCents: 0, platformCutCents: 0 },
  );
}

/** Sum of (sale − goods/services − platform fee) per line. */
function paidOrderShopProfitCents(o: DashboardPaidOrderRow) {
  const t = paidOrderMerchandiseTotals(o);
  return t.saleCents - t.goodsServicesCostCents - t.platformCutCents;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** UTC calendar date as MM/DD for listing status lines. */
function formatListingCalendarMd(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  } catch {
    return "";
  }
}

function requestStatusDescription(listing: DashboardListingRow): string {
  switch (listing.requestStatus) {
    case ListingRequestStatus.draft:
      return "Draft — finish artwork / URLs and submit when ready.";
    case ListingRequestStatus.submitted: {
      const md = formatListingCalendarMd(listing.updatedAtIso);
      return md ? `Submitted ${md}` : "Submitted";
    }
    case ListingRequestStatus.images_ok:
      return "In review — image check passed; admin is linking Printify. Your listing badge stays In review until approval.";
    case ListingRequestStatus.printify_item_created:
      return "Printify item created — waiting for admin approval.";
    case ListingRequestStatus.approved:
      return "";
    case ListingRequestStatus.rejected:
      return "Rejected — this listing cannot be edited. Contact support if you need help.";
    default:
      return String(listing.requestStatus);
  }
}

function statusBadgeClass(status: ListingRequestStatus, active: boolean): string {
  if (active) return "bg-emerald-950/50 text-emerald-300/90 ring-emerald-800/50";
  switch (status) {
    case ListingRequestStatus.submitted:
    case ListingRequestStatus.images_ok:
    case ListingRequestStatus.printify_item_created:
      return "bg-amber-950/40 text-amber-200/90 ring-amber-800/50";
    case ListingRequestStatus.approved:
      return "bg-sky-950/40 text-sky-200/90 ring-sky-800/50";
    case ListingRequestStatus.rejected:
      return "bg-red-950/40 text-red-200/90 ring-red-900/50";
    default:
      return "bg-zinc-900/80 text-zinc-400 ring-zinc-700/80";
  }
}

function buildListingDerived(
  listing: DashboardListingRow,
  shopSlug: string,
  isPlatform: boolean,
  listingFeeBonusFreeSlots: number,
) {
  const minCents = dashboardListingMinPriceHintCents(listing.product);
  const minLabel = formatMoney(minCents);
  const listingLocked =
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null;
  const awaitingAdminReview =
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created;
  const fieldsReadOnly = listingLocked || awaitingAdminReview;
  const canSubmit =
    !listingLocked && listing.requestStatus === ListingRequestStatus.draft;
  const imagesDefault = Array.isArray(listing.requestImages)
    ? (listing.requestImages as string[]).join("\n")
    : "";
  const feeCents = listingFeeCentsForOrdinal(listing.listingOrdinal, shopSlug, listingFeeBonusFreeSlots);
  const isFreeListingSlot = feeCents === 0;
  const founderFreeShop = isFounderUnlimitedFreeListingsShop(shopSlug);
  const freeSlotCap = listingFeeFreeSlotCap(shopSlug, listingFeeBonusFreeSlots);
  const dashboardBadge = listing.creatorRemovedFromShopAt
    ? {
        label: "Creator removed",
        ringClass: "bg-fuchsia-950/45 text-fuchsia-200/90 ring-fuchsia-800/50",
      }
    : listing.adminRemovedFromShopAt
      ? {
          label: "Frozen",
          ringClass: "bg-sky-950/50 text-sky-200/90 ring-sky-800/50",
        }
      : listing.requestStatus === ListingRequestStatus.rejected
        ? {
            label: "Rejected",
            ringClass: "bg-red-950/40 text-red-200/90 ring-red-900/50",
          }
        : listing.active
          ? {
              label: "Live",
              ringClass: statusBadgeClass(listing.requestStatus, true),
            }
          : {
              label: !isPlatform
                ? listing.requestStatus === ListingRequestStatus.draft
                  ? "Draft"
                  : listing.requestStatus === ListingRequestStatus.approved
                    ? "Fee pending"
                    : listing.requestStatus === ListingRequestStatus.submitted ||
                        listing.requestStatus === ListingRequestStatus.images_ok ||
                        listing.requestStatus === ListingRequestStatus.printify_item_created
                      ? "In review"
                      : String(listing.requestStatus)
                : String(listing.requestStatus),
              ringClass: statusBadgeClass(listing.requestStatus, false),
            };
  const canRemoveFromShop =
    !isPlatform &&
    listing.requestStatus === ListingRequestStatus.approved &&
    listing.active &&
    !listing.creatorRemovedFromShopAt &&
    !listing.adminRemovedFromShopAt;
  const showOwnerSupplementSection =
    !isPlatform &&
    listing.requestStatus === ListingRequestStatus.approved &&
    listing.creatorRemovedFromShopAt == null;
  const canEditOwnerSupplement =
    showOwnerSupplementSection && listing.adminRemovedFromShopAt == null;
  const catalogUrls = productImageUrlsUnionHero({
    imageUrl: listing.product.imageUrl,
    imageGallery: listing.product.imageGallery,
  });
  const savedCatalogSelection = parseListingStorefrontCatalogImageSelection(
    listing.listingStorefrontCatalogImageUrls,
  );
  /** Catalog image toggles (or a single-line note when only one hero image exists). */
  const showCatalogImagePicker = showOwnerSupplementSection && canEditOwnerSupplement;

  return {
    minLabel,
    listingLocked,
    awaitingAdminReview,
    fieldsReadOnly,
    canSubmit,
    imagesDefault,
    feeCents,
    isFreeListingSlot,
    founderFreeShop,
    freeSlotCap,
    dashboardBadge,
    canRemoveFromShop,
    showOwnerSupplementSection,
    canEditOwnerSupplement,
    catalogUrls,
    savedCatalogSelection,
    showCatalogImagePicker,
  };
}

function ListingOptionPanel({
  listing,
  isPlatform,
  shopSlug,
  listingFeeBonusFreeSlots,
  r2Configured,
  shopStripeConnectReadyForCharges,
  stripePublishableKey,
  mockListingFeeCheckout,
  freeListingFooterNote = null,
  variantLabel,
  stacked,
  onCloseExpanded,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  shopSlug: string;
  listingFeeBonusFreeSlots: number;
  r2Configured: boolean;
  shopStripeConnectReadyForCharges: boolean;
  stripePublishableKey: string | null;
  mockListingFeeCheckout: boolean;
  /** Shown bottom-left next to “Delete Listing” when expanded (e.g. free slot ordinal). */
  freeListingFooterNote?: string | null;
  /** When set (legacy grouped card), show per-option catalog line. */
  variantLabel?: string;
  /** Second+ option in a legacy group — add top divider. */
  stacked?: boolean;
  /** Collapse the listing card (shown beside Delete Listing when removal is allowed). */
  onCloseExpanded?: () => void;
}) {
  const removeListingDialogTitleId = useId();
  const [removeListingDialogOpen, setRemoveListingDialogOpen] = useState(false);
  const [removeListingPending, setRemoveListingPending] = useState(false);
  const d = buildListingDerived(listing, shopSlug, isPlatform, listingFeeBonusFreeSlots);
  const {
    canSubmit,
    imagesDefault,
    feeCents,
    canRemoveFromShop,
    showOwnerSupplementSection,
    canEditOwnerSupplement,
    catalogUrls,
    savedCatalogSelection,
    showCatalogImagePicker,
  } = d;
  const embeddedSupplementCatalogPair =
    showOwnerSupplementSection && showCatalogImagePicker && catalogUrls.length > 0;

  return (
    <div className={stacked ? "mt-4 border-t border-zinc-800/80 pt-4" : ""}>
      {variantLabel ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Option: {variantLabel}</p>
      ) : null}
      {variantLabel && listing.rejectionReasonText ? (
        <p className="mb-2 text-xs leading-snug text-red-200/85">
          <DashboardNoticeBody body={listing.rejectionReasonText} />
        </p>
      ) : null}

      {showOwnerSupplementSection && listing.adminListingSecondaryImageUrl ? (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <p className="text-xs font-medium text-zinc-500">Platform listing photo</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Added by the platform. It shows on your public listing with the main product images — you cannot remove it
            here.
          </p>
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.adminListingSecondaryImageUrl}
              alt=""
              className="h-24 w-24 rounded border border-zinc-700 object-cover"
            />
          </div>
        </div>
      ) : null}
      {showOwnerSupplementSection || showCatalogImagePicker ? (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          {embeddedSupplementCatalogPair ? (
            <ListingEmbeddedSupplementCatalogPair
              key={listing.id}
              listingId={listing.id}
              ownerSupplementImageUrl={listing.ownerSupplementImageUrl?.trim() ?? ""}
              ownerSupplementPendingImageUrl={listing.ownerSupplementPendingImageUrl?.trim() ?? ""}
              catalogUrls={catalogUrls}
              savedCatalogSelection={savedCatalogSelection}
              canEdit={canEditOwnerSupplement}
              r2Configured={r2Configured}
            />
          ) : (
            <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
              {showOwnerSupplementSection ? (
                <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col">
                  <DashboardListingSupplementPhotoForm
                    embedded
                    listingId={listing.id}
                    ownerSupplementImageUrl={listing.ownerSupplementImageUrl}
                    ownerSupplementPendingImageUrl={listing.ownerSupplementPendingImageUrl}
                    ownerSupplementPendingSubmittedAtIso={
                      listing.ownerSupplementPendingSubmittedAtIso
                    }
                    r2Configured={r2Configured}
                    canEdit={canEditOwnerSupplement}
                  />
                </div>
              ) : null}
              {showCatalogImagePicker ? (
                <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col">
                  <ListingStorefrontCatalogImagesForms
                    embedded
                    key={listing.id}
                    listingId={listing.id}
                    catalogUrls={catalogUrls}
                    savedCatalogSelection={savedCatalogSelection}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {!isPlatform &&
        !listing.listingFeePaidAt &&
        feeCents > 0 &&
        listing.creatorRemovedFromShopAt == null &&
        listing.adminRemovedFromShopAt == null &&
        (listing.requestStatus === ListingRequestStatus.draft ||
          listing.requestStatus === ListingRequestStatus.approved ||
          listing.requestStatus === ListingRequestStatus.submitted ||
          listing.requestStatus === ListingRequestStatus.images_ok ||
          listing.requestStatus === ListingRequestStatus.printify_item_created) ? (
        mockListingFeeCheckout ? (
          <form action={dashboardPayListingFee} className="mt-3">
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              className="rounded border border-blue-900/60 bg-blue-950/30 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-700/60"
            >
              Apply listing credit (mock checkout)
            </button>
          </form>
        ) : (
          <p className="mt-3 rounded-lg border border-amber-900/45 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
            This listing needs listing credits before you can submit or publish.{" "}
            <Link
              href="/dashboard?dash=requestListing"
              className="text-amber-100 underline-offset-2 hover:underline"
            >
              Buy listing credits on the Request listing tab
            </Link>
            .
          </p>
        )
      ) : null}

      {canSubmit ? (
        <DashboardSubmitListingRequestForm
          listingId={listing.id}
          defaultImageUrlsText={imagesDefault}
          feeBlocksSubmit={feeCents > 0 && !listing.listingFeePaidAt}
        />
      ) : null}

      {freeListingFooterNote || canRemoveFromShop ? (
        <div
          className={`mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 ${freeListingFooterNote ? "justify-between" : "justify-end"}`}
        >
          {freeListingFooterNote ? (
            <p className="min-w-0 flex-1 text-left text-xs text-zinc-600">{freeListingFooterNote}</p>
          ) : null}
          {canRemoveFromShop ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded border border-red-900/55 bg-red-950/35 px-3 py-1.5 text-xs font-medium text-red-200/95 hover:border-red-700/60 hover:bg-red-950/50 disabled:opacity-60"
                disabled={removeListingPending}
                onClick={() => setRemoveListingDialogOpen(true)}
              >
                Delete Listing
              </button>
              {onCloseExpanded ? (
                <button
                  type="button"
                  onClick={onCloseExpanded}
                  className="inline-flex w-14 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-900/40 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Close
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {removeListingDialogOpen ? (
        <RemoveListingFromShopConfirmDialog
          titleId={removeListingDialogTitleId}
          pending={removeListingPending}
          onDismiss={() => setRemoveListingDialogOpen(false)}
          onConfirmDelete={async () => {
            setRemoveListingPending(true);
            try {
              const fd = new FormData();
              fd.set("listingId", listing.id);
              await dashboardCreatorRemoveListingFromShop(fd);
              setRemoveListingDialogOpen(false);
              onCloseExpanded?.();
            } finally {
              setRemoveListingPending(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RemoveListingFromShopConfirmDialog({
  titleId,
  pending,
  onDismiss,
  onConfirmDelete,
}: {
  titleId: string;
  pending: boolean;
  onDismiss: () => void;
  onConfirmDelete: () => void | Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss, pending]);

  return (
    <div
      className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        disabled={pending}
        onClick={() => {
          if (!pending) onDismiss();
        }}
      />
      <div className="relative z-[1] w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
        <h2 id={titleId} className="text-base font-semibold text-zinc-100">
          Are you sure?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This will remove it from your shop completely.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This cannot be undone. Any listing coupons used or money paid is{" "}
          <strong className="font-semibold text-zinc-200">non-refundable</strong>.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="rounded border border-zinc-600 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-60"
            disabled={pending}
            onClick={onDismiss}
          >
            Do not delete
          </button>
          <button
            type="button"
            className="rounded border border-red-900/55 bg-red-950/35 px-3 py-1.5 text-xs font-medium text-red-200/95 hover:border-red-700/60 hover:bg-red-950/50 disabled:opacity-60"
            disabled={pending}
            onClick={onConfirmDelete}
          >
            {pending ? "Removing…" : "Yes, delete listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Stable R2 URL after replace — bust browser/CDN cache when listing row refreshes. */
function heroThumbSrcWithCacheBust(heroUrl: string, updatedAtIso: string): string {
  const u = heroUrl.trim();
  if (!u) return "";
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${encodeURIComponent(updatedAtIso)}`;
}

function ListingCard({
  listing,
  isPlatform,
  shopSlug,
  listingFeeBonusFreeSlots,
  r2Configured,
  shopStripeConnectReadyForCharges,
  stripePublishableKey,
  mockListingFeeCheckout,
  moderationKeywordPhrases,
}: {
  listing: DashboardListingRow;
  isPlatform: boolean;
  shopSlug: string;
  listingFeeBonusFreeSlots: number;
  r2Configured: boolean;
  shopStripeConnectReadyForCharges: boolean;
  stripePublishableKey: string | null;
  mockListingFeeCheckout: boolean;
  moderationKeywordPhrases: readonly string[];
}) {
  const { fieldsReadOnly, listingLocked, awaitingAdminReview, isFreeListingSlot, founderFreeShop, freeSlotCap } =
    buildListingDerived(listing, shopSlug, isPlatform, listingFeeBonusFreeSlots);
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  /** Load iframe after modal paints — avoids main-thread/GPU spike (blur + nested doc + RSC). */
  const [previewIframeReady, setPreviewIframeReady] = useState(false);
  const suppressPreviewBackdropCloseRef = useRef(false);
  const previewTitleId = useId();
  const showPreviewButton =
    !awaitingAdminReview &&
    listing.requestStatus !== ListingRequestStatus.rejected &&
    listing.creatorRemovedFromShopAt == null &&
    listing.adminRemovedFromShopAt == null;
  const showExpandButton = !listingLocked && !awaitingAdminReview;
  const lockedSubline = listingLocked
    ? listing.requestStatus === ListingRequestStatus.rejected
      ? "Rejected — this listing cannot be edited."
      : listing.creatorRemovedFromShopAt != null
        ? "Creator removed — this listing will not appear on your storefront."
        : listing.adminRemovedFromShopAt != null
          ? "Frozen — this listing will not appear on your storefront."
          : requestStatusDescription(listing)
    : null;

  const freeListingInline =
    !isPlatform && isFreeListingSlot
      ? founderFreeShop
        ? "Free listing (unlimited)."
        : `Free listing (${listing.listingOrdinal} of ${freeSlotCap}).`
      : null;
  const statusLine = requestStatusDescription(listing);
  const shopPitch = listing.storefrontItemBlurb?.trim() || null;
  const compactTitle = (listing.requestItemName?.trim() || listing.product.name).trim() || "Listing";
  const heroUrl =
    productPrimaryImageForShopListing(listing.product, {
      adminListingSecondaryImageUrl: listing.adminListingSecondaryImageUrl,
      ownerSupplementImageUrl: listing.ownerSupplementImageUrl,
      listingStorefrontCatalogImageUrls: parseListingStorefrontCatalogImageSelection(
        listing.listingStorefrontCatalogImageUrls,
      ),
    })?.trim() || "";
  const productSlug = listing.product.slug;
  const openFullPath = isPlatform
    ? `/product/${encodeURIComponent(productSlug)}`
    : `/s/${encodeURIComponent(shopSlug)}/product/${encodeURIComponent(productSlug)}`;
  const embedPath = isPlatform
    ? `/embed/product/${encodeURIComponent(productSlug)}`
    : `/embed/product/${encodeURIComponent(productSlug)}?shop=${encodeURIComponent(shopSlug)}`;

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewOpen]);

  /**
   * Ignore scrim close briefly after open — the opening pointer can finish with a `click` on the
   * full-screen layer (first open only per listing is common); two rAF was too short on Windows.
   */
  useEffect(() => {
    if (!previewOpen) {
      suppressPreviewBackdropCloseRef.current = false;
      return;
    }
    suppressPreviewBackdropCloseRef.current = true;
    const t = window.setTimeout(() => {
      suppressPreviewBackdropCloseRef.current = false;
    }, 550);
    return () => {
      clearTimeout(t);
      suppressPreviewBackdropCloseRef.current = false;
    };
  }, [previewOpen]);

  useEffect(() => {
    if (!previewOpen) {
      setPreviewIframeReady(false);
      return;
    }
    const t = window.setTimeout(() => {
      setPreviewIframeReady(true);
    }, 32);
    return () => {
      clearTimeout(t);
      setPreviewIframeReady(false);
    };
  }, [previewOpen]);

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!awaitingAdminReview ? (
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
              {heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  src={heroThumbSrcWithCacheBust(heroUrl, listing.updatedAtIso)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {awaitingAdminReview ? (
              <div className="flex min-w-0 items-baseline gap-3">
                <p className="shrink-0 truncate text-sm font-medium text-zinc-100">{compactTitle}</p>
                {shopPitch ? (
                  <p className="min-w-0 flex-1 truncate text-[11px] leading-snug text-zinc-500">
                    {shopPitch}
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="truncate text-sm font-medium text-zinc-100">{compactTitle}</p>
                {lockedSubline ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">
                    {lockedSubline}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showPreviewButton ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewOpen(true);
              }}
              className="rounded border border-blue-800/55 bg-blue-950/40 px-2.5 py-1 text-xs text-blue-100 hover:border-blue-600/60 hover:bg-blue-950/55"
            >
              Preview
            </button>
          ) : null}
          {showExpandButton ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex w-14 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-900/40 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              {expanded ? "Close" : fieldsReadOnly ? "View" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {previewOpen
        ? createPortal(
            <div className="store-modal-overlay-scroll fixed inset-0 z-[2500] flex items-start justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                aria-label="Close product"
                className="fixed inset-0 bg-black/80"
                onClick={() => {
                  if (suppressPreviewBackdropCloseRef.current) return;
                  setPreviewOpen(false);
                }}
              />
              <div
                className="store-dimension-panel store-product-modal-panel animate-store-panel-in relative z-[2501] flex w-full max-h-[min(calc(100dvh-2rem),calc(100svh-2rem))] min-h-0 max-w-3xl flex-col overflow-hidden shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby={previewTitleId}
              >
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close"
                  className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 shadow-sm backdrop-blur-sm transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100 sm:right-3 sm:top-3"
                >
                  ×
                </button>
                <div className="store-product-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-10 pr-14 sm:px-10 sm:pb-10 sm:pt-6 sm:pr-16">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 id={previewTitleId} className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Preview
                    </h2>
                    <a
                      href={openFullPath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400/90 underline-offset-2 hover:underline"
                    >
                      Open full page
                    </a>
                  </div>
                  {previewIframeReady ? (
                    <iframe
                      title={`Item details: ${compactTitle}`}
                      src={embedPath}
                      loading="lazy"
                      className="h-[min(860px,calc(100dvh-8rem))] w-full border-0 bg-zinc-950"
                    />
                  ) : (
                    <div
                      className="flex h-[min(860px,calc(100dvh-8rem))] w-full items-center justify-center border-0 bg-zinc-950 text-sm text-zinc-500"
                      aria-hidden
                    >
                      Loading preview…
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {expanded ? (
        <>
          <div className="mt-3 w-full min-w-0 border-t border-zinc-800 pt-3">
            <DashboardListingItemNameForm
              listingId={listing.id}
              catalogProductName={listing.product.name}
              requestItemName={listing.requestItemName}
              readOnly={fieldsReadOnly}
              moderationPhrases={moderationKeywordPhrases}
              moderationStorefrontBlurb={listing.storefrontItemBlurb}
              moderationListingSearchKeywords={listing.listingSearchKeywords}
            />
            <DashboardListingPriceForm
              listingId={listing.id}
              priceDollarsFormatted={(listing.priceCents / 100).toFixed(2)}
              goodsServicesUnitCents={listing.goodsServicesUnitCents}
              product={{
                fulfillmentType: listing.product.fulfillmentType,
                priceCents: listing.product.priceCents,
                minPriceCents: listing.product.minPriceCents,
                printifyVariantId: listing.product.printifyVariantId,
              }}
              readOnly={fieldsReadOnly}
            />
          </div>

          <DashboardListingStorefrontBlurbForm
            listingId={listing.id}
            catalogProductName={listing.product.name}
            storefrontItemBlurb={listing.storefrontItemBlurb}
            readOnly={fieldsReadOnly}
            moderationPhrases={moderationKeywordPhrases}
            moderationRequestItemName={listing.requestItemName}
            moderationListingSearchKeywords={listing.listingSearchKeywords}
          />
          <DashboardListingSearchKeywordsForm
            listingId={listing.id}
            catalogProductName={listing.product.name}
            listingSearchKeywords={listing.listingSearchKeywords}
            readOnly={fieldsReadOnly}
            moderationPhrases={moderationKeywordPhrases}
            moderationRequestItemName={listing.requestItemName}
            moderationStorefrontBlurb={listing.storefrontItemBlurb}
          />
          {listing.requestStatus === ListingRequestStatus.rejected ? (
            <details className="mt-1 group">
              <summary className="flex cursor-pointer list-none items-baseline gap-2 text-xs text-zinc-500">
                <span className="min-w-0 flex-1">Rejected — this listing cannot be edited.</span>
                <span
                  className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                  aria-hidden
                >
                  Details
                  <span className="ml-1 inline-block transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              {listing.rejectionReasonText ? (
                <div className="mt-1 text-xs leading-snug text-red-200/85">
                  <DashboardNoticeBody body={listing.rejectionReasonText} />
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-600">No additional rejection details were provided.</p>
              )}
            </details>
          ) : statusLine ? (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-zinc-500">
              <span>{statusLine}</span>
            </p>
          ) : null}

          <ListingOptionPanel
            listing={listing}
            isPlatform={isPlatform}
            shopSlug={shopSlug}
            listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
            r2Configured={r2Configured}
            shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
            stripePublishableKey={stripePublishableKey}
            mockListingFeeCheckout={mockListingFeeCheckout}
            freeListingFooterNote={freeListingInline}
            onCloseExpanded={() => setExpanded(false)}
          />
        </>
      ) : null}
    </li>
  );
}

type TabId = DashboardMainTabId;

function DashboardTabLoadFailed(props: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200/90">
      <p>{props.message}</p>
      <button
        type="button"
        className="mt-2 rounded-md border border-amber-800/60 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-950/50"
        onClick={props.onRetry}
      >
        Try again
      </button>
    </div>
  );
}

function normalizeDashboardMainTab(
  i: TabId | undefined,
  opts: {
    hasSetup: boolean;
    showOnboardingTab: boolean;
    hasNotifications: boolean;
    canSupport: boolean;
    guidelinesAcknowledged: boolean;
  },
): TabId {
  const {
    hasSetup,
    showOnboardingTab,
    hasNotifications,
    canSupport,
    guidelinesAcknowledged,
  } = opts;
  const defaultCreatorTab: TabId = showOnboardingTab ? "setup" : "listings";

  if (hasSetup) {
    let t = i;
    if (t === "setup" && !showOnboardingTab) t = defaultCreatorTab;
    if (t === "itemGuidelines" && !showOnboardingTab) t = defaultCreatorTab;
    if (t === "itemGuidelines" && guidelinesAcknowledged) t = defaultCreatorTab;

    if (
      t === "listings" ||
      t === "orders" ||
      t === "setup" ||
      t === "shopProfile" ||
      (t === "itemGuidelines" && showOnboardingTab && !guidelinesAcknowledged) ||
      t === "bugFeedback" ||
      t === "notifications" ||
      t === "requestListing" ||
      (t === "support" && canSupport) ||
      t === "accountInfo"
    ) {
      if (t === "notifications" && !hasNotifications) return defaultCreatorTab;
      if (t === "support" && !canSupport) return defaultCreatorTab;
      return t;
    }
    return defaultCreatorTab;
  }
  if (i === "orders") return "orders";
  if (i === "support" && canSupport) return "support";
  if (i === "accountInfo") return "listings";
  return "listings";
}

export function DashboardMainTabs(props: {
  initialTab?: TabId;
  /** Current URL query without `dash` (server-built); merged into tab links so fee/promo etc. persist. */
  dashboardQueryPreserve: string;
  /** Creator shop slug — listing fee tiers (e.g. founder unlimited). */
  shopSlug: string;
  /** Creator onboarding; when set, “Onboarding” is the first tab. */
  setup?: DashboardSetupPanelProps | null;
  /** Full notice history (creators); loaded when the Notifications tab is opened. */
  notifications?: {
    rows: DashboardNoticeRow[];
    unreadCount: number;
  } | null;
  /** Unread count from the server when notification rows are not in this payload (other tabs). */
  notificationsUnreadCount?: number;
  /** Staff replies after the creator’s last message — Support tab badge only. */
  supportNewFromStaffCount?: number;
  /** Support thread payload (creator shops); loaded with Support tab or via lazy fetch. */
  supportChat?: DashboardSupportChatPayload | null;
  /** Which tab payloads were included in the initial RSC response (`?dash=`). */
  initialTabDataLoaded: {
    listings: boolean;
    orders: boolean;
    notifications: boolean;
    support: boolean;
    requestListingCatalog: boolean;
  };
  /** Extra free publication slots granted by admin (non-founder creator shops). */
  listingFeeBonusFreeSlots: number;
  isPlatform: boolean;
  listings: DashboardListingRow[];
  /** Server-built groups (live / request / removed) — legacy variant stubs merged for display. */
  groupedListingSections: {
    live: GroupedDashboardListing<DashboardListingRow>[];
    request: GroupedDashboardListing<DashboardListingRow>[];
    removed: GroupedDashboardListing<DashboardListingRow>[];
  };
  paidOrders: DashboardPaidOrderRow[];
  /** R2 configured for optional listing photo uploads (creator shops). */
  r2Configured: boolean;
  /** When set, Request listing tab pre-fills from this draft (baseline stub listings only). */
  draftListingRequestPrefill?: DraftListingRequestPrefillPayload | null;
  /** Server-only mock listing fee pay (MOCK_CHECKOUT=1). */
  mockListingFeeCheckout: boolean;
  /** Connect account ready to accept listing-fee card charges. */
  shopStripeConnectReadyForCharges: boolean;
  /** Stripe.js publishable key for embedded listing fee card pay. */
  stripePublishableKey: string | null;
  /** When true, show demo paid-order control on Orders tab (local dev + env flag + admin session). */
  showDemoPurchaseButton?: boolean;
  /** Creator sign-in email + verification state for the Account info tab. */
  shopAccount?: DashboardShopAccountPayload | null;
  /** Phrases for client-side moderation blur checks (same bank as server actions). */
  moderationKeywordPhrases?: readonly string[];
  /** When true, tab bodies load via `/api/dashboard/*` on first open (saves Vercel CPU). */
  clientTabFetch?: boolean;
}) {
  const {
    initialTab: initialTabProp,
    dashboardQueryPreserve,
    shopSlug,
    setup: initialSetup,
    notifications: initialNotifications,
    notificationsUnreadCount = 0,
    supportNewFromStaffCount = 0,
    supportChat: initialSupportChat,
    listingFeeBonusFreeSlots,
    isPlatform,
    listings: initialListings,
    groupedListingSections: initialGroupedListingSections,
    paidOrders: initialPaidOrders,
    r2Configured,
    draftListingRequestPrefill: initialDraftPrefill = null,
    mockListingFeeCheckout,
    shopStripeConnectReadyForCharges,
    stripePublishableKey,
    showDemoPurchaseButton = false,
    initialTabDataLoaded,
    shopAccount = null,
    moderationKeywordPhrases: initialModerationPhrases = [],
    clientTabFetch = false,
  } = props;

  const tabFetch = useDashboardTabFetch({ enabled: clientTabFetch, isPlatform });
  const router = useRouter();
  const searchParams = useSearchParams();

  const refreshSupportChat = useCallback(() => {
    if (clientTabFetch) {
      void tabFetch.loadTab("support", { force: true });
      return;
    }
    router.refresh();
  }, [clientTabFetch, tabFetch, router]);

  const [listingSubmittedFlash, setListingSubmittedFlash] = useState(false);

  const [loadedFlags, setLoadedFlags] = useState(initialTabDataLoaded);
  const [listings, setListings] = useState(initialListings);
  const [groupedListingSections, setGroupedListingSections] = useState(initialGroupedListingSections);
  const [paidOrders, setPaidOrders] = useState(initialPaidOrders);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [supportChat, setSupportChat] = useState(initialSupportChat);
  const [setup, setSetup] = useState(initialSetup);

  const handleGuidelinesAcknowledged = useCallback(() => {
    setSetup((current) => {
      if (!current || current.itemGuidelinesAcknowledged) return current;
      const patched = onboardingSetupAfterGuidelinesAcknowledged(current.steps);
      return {
        ...current,
        itemGuidelinesAcknowledged: true,
        steps: patched.steps,
        incompleteSetupCount: patched.incompleteSetupCount,
        setupTabsKey: dashboardSetupTabsKey(patched.steps, true),
      };
    });
  }, []);
  const [draftListingRequestPrefill, setDraftListingRequestPrefill] = useState(initialDraftPrefill);

  const effectiveLoadedFlags: DashboardTabLoadedFlags = clientTabFetch
    ? tabFetch.loadedFlags
    : loadedFlags;
  const effectiveListings = clientTabFetch ? tabFetch.listings : listings;
  const effectiveGroupedListingSections = clientTabFetch
    ? tabFetch.groupedListingSections
    : groupedListingSections;
  const effectivePaidOrders = clientTabFetch ? tabFetch.paidOrders : paidOrders;
  const effectiveNotifications = clientTabFetch ? tabFetch.notifications : notifications;
  const effectiveSupportChat = clientTabFetch ? tabFetch.supportChat : supportChat;
  const effectiveModerationPhrases = clientTabFetch
    ? tabFetch.moderationKeywordPhrases
    : initialModerationPhrases;

  const handleNoticeMarkedRead = useCallback(
    async (noticeId: string) => {
      if (clientTabFetch) {
        await tabFetch.loadTab("notifications", { force: true });
        return;
      }
      setNotifications((prev) => {
        if (!prev) return prev;
        const row = prev.rows.find((r) => r.id === noticeId);
        if (!row || row.readAt != null) return prev;
        const readAt = new Date().toISOString();
        return {
          rows: prev.rows.map((r) => (r.id === noticeId ? { ...r, readAt } : r)),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        };
      });
    },
    [clientTabFetch, tabFetch],
  );

  /** RSC can send new props without remounting (e.g. `router.refresh`); re-seed client tab cache. */
  useEffect(() => {
    if (clientTabFetch) return;
    setLoadedFlags(initialTabDataLoaded);
    setListings(initialListings);
    setGroupedListingSections(initialGroupedListingSections);
    setPaidOrders(initialPaidOrders);
    setNotifications(initialNotifications);
    setSupportChat(initialSupportChat);
    setSetup(initialSetup);
    setDraftListingRequestPrefill(initialDraftPrefill);
  }, [
    clientTabFetch,
    initialTabDataLoaded,
    initialListings,
    initialGroupedListingSections,
    initialPaidOrders,
    initialNotifications,
    initialSupportChat,
    initialSetup,
    initialDraftPrefill,
  ]);

  const hasSetup = setup != null;
  const showOnboardingTab = Boolean(setup && setup.incompleteSetupCount > 0);
  const guidelinesAcknowledged = Boolean(setup?.itemGuidelinesAcknowledged);
  /** Notifications tab is always available for creator shops; rows load when the tab is opened. */
  const hasNotifications = !isPlatform ? true : Boolean(effectiveNotifications);
  const canSupport = !isPlatform;
  const tabOpts = {
    hasSetup,
    showOnboardingTab,
    hasNotifications,
    canSupport,
    guidelinesAcknowledged,
  };
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    normalizeDashboardMainTab(initialTabProp, tabOpts),
  );
  const shopDashboardTabsContainerRef = useRef<HTMLDivElement>(null);
  const shopDashboardTabsMeasureRef = useRef<HTMLDivElement>(null);
  const [shopDashboardTabsStacked, setShopDashboardTabsStacked] = useState(false);

  useEffect(() => {
    setActiveTab(normalizeDashboardMainTab(initialTabProp, tabOpts));
  }, [initialTabProp, tabOpts.hasSetup, tabOpts.showOnboardingTab, tabOpts.hasNotifications, tabOpts.canSupport, tabOpts.guidelinesAcknowledged]);

  useEffect(() => {
    if (!clientTabFetch) return;
    const dash = searchParams.get("dash");
    if (!dash) return;
    setActiveTab(
      normalizeDashboardMainTab(
        dash as DashboardMainTabId,
        tabOpts,
      ),
    );
  }, [clientTabFetch, searchParams, tabOpts]);

  const tabFetchIdForTab = useCallback((id: TabId): keyof DashboardTabLoadedFlags | null => {
    switch (id) {
      case "listings":
        return "listings";
      case "orders":
        return "orders";
      case "notifications":
        return "notifications";
      case "support":
        return "support";
      case "requestListing":
        return "requestListingCatalog";
      default:
        return null;
    }
  }, []);

  const syncDashboardTabUrl = useCallback(
    (id: TabId) => {
      const p = new URLSearchParams(dashboardQueryPreserve);
      p.set("dash", dashQueryParamForTabId(id));
      const q = p.toString();
      const path = q ? `/dashboard?${q}` : `/dashboard?dash=${dashQueryParamForTabId(id)}`;
      window.history.replaceState(null, "", path);
    },
    [dashboardQueryPreserve],
  );

  const selectTab = useCallback(
    (id: TabId) => {
      const next = normalizeDashboardMainTab(id, tabOpts);
      setActiveTab(next);
      syncDashboardTabUrl(next);
      if (clientTabFetch) {
        const fetchId = tabFetchIdForTab(next);
        if (fetchId) void tabFetch.loadTab(fetchId);
      }
    },
    [clientTabFetch, tabFetch, tabFetchIdForTab, syncDashboardTabUrl, tabOpts],
  );

  const afterListingSubmitted = useCallback(() => {
    setSetup((current) => {
      if (!current) return current;
      const patched = onboardingSetupAfterListingSubmitted(current.steps);
      return {
        ...current,
        steps: patched.steps,
        incompleteSetupCount: patched.incompleteSetupCount,
        setupTabsKey: dashboardSetupTabsKey(patched.steps, current.itemGuidelinesAcknowledged),
      };
    });
    setListingSubmittedFlash(true);
    window.setTimeout(() => setListingSubmittedFlash(false), 8000);
    selectTab("listings");
    if (clientTabFetch) {
      void tabFetch.loadTab("listings", { force: true });
    }
  }, [clientTabFetch, selectTab, tabFetch]);

  useEffect(() => {
    if (!clientTabFetch) return;
    const fetchId = tabFetchIdForTab(activeTab);
    if (fetchId) void tabFetch.loadTab(fetchId);
  }, [clientTabFetch, activeTab, tabFetch, tabFetchIdForTab]);

  useEffect(() => {
    if (!clientTabFetch || !tabFetch.requestListingCatalog) return;
    const rc = tabFetch.requestListingCatalog;
    setSetup((s) =>
      s
        ? {
            ...s,
            catalogGroups: rc.catalogGroups,
            listingPickerDiagnostics: { adminCatalogItemCount: rc.adminCatalogItemCount },
            unpaidPublicationFeeListings: rc.unpaidPublicationFeeListings,
            freeListingSlots: rc.freeListingSlots,
          }
        : s,
    );
    setDraftListingRequestPrefill(rc.draftListingRequestPrefill);
  }, [clientTabFetch, tabFetch.requestListingCatalog]);

  const tabHref = (id: TabId) => {
    const qv = dashQueryParamForTabId(id);
    const p = new URLSearchParams(dashboardQueryPreserve);
    p.set("dash", qv);
    const q = p.toString();
    return q ? `/dashboard?${q}` : `/dashboard?dash=${qv}`;
  };

  const baseId = useId();
  const setupTabId = `${baseId}-tab-setup`;
  const setupPanelId = `${baseId}-panel-setup`;
  const shopProfileTabId = `${baseId}-tab-shop-profile`;
  const shopProfilePanelId = `${baseId}-panel-shop-profile`;
  const itemGuidelinesTabId = `${baseId}-tab-item-guidelines`;
  const itemGuidelinesPanelId = `${baseId}-panel-item-guidelines`;
  const requestListingTabId = `${baseId}-tab-request-listing`;
  const requestListingPanelId = `${baseId}-panel-request-listing`;
  const bugFeedbackPanelId = `${baseId}-panel-bug-feedback`;
  const listingsTabId = `${baseId}-tab-listings`;
  const notificationsTabId = `${baseId}-tab-notifications`;
  const notificationsPanelId = `${baseId}-panel-notifications`;
  const ordersTabId = `${baseId}-tab-orders`;
  const supportTabId = `${baseId}-tab-support`;
  const listingsPanelId = `${baseId}-panel-listings`;
  const ordersPanelId = `${baseId}-panel-orders`;
  const supportPanelId = `${baseId}-panel-support`;
  const accountInfoTabId = `${baseId}-tab-account-info`;
  const accountInfoPanelId = `${baseId}-panel-account-info`;

  const { live: groupedLive, request: groupedRequest, removed: groupedRemoved } =
    effectiveGroupedListingSections;

  const tabBtnClass = (active: boolean) =>
    `inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600"
        : "text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300"
    }`;

  const tabBtn = (id: TabId, label: ReactNode, tabId: string, panelId: string) => {
    if (clientTabFetch) {
      return (
        <button
          type="button"
          role="tab"
          id={tabId}
          aria-selected={activeTab === id}
          aria-controls={panelId}
          tabIndex={activeTab === id ? 0 : -1}
          className={tabBtnClass(activeTab === id)}
          onClick={() => selectTab(id)}
        >
          {label}
        </button>
      );
    }
    return (
      <Link
        href={tabHref(id)}
        prefetch={false}
        scroll={false}
        role="tab"
        id={tabId}
        aria-selected={activeTab === id}
        aria-controls={panelId}
        tabIndex={activeTab === id ? 0 : -1}
        className={tabBtnClass(activeTab === id)}
      >
        {label}
      </Link>
    );
  };

  /** Same footprint as {@link tabBtn} — opens shop upgrades page (not a `?dash=` tab). */
  const promotionsPageBtn = () => (
    <Link
      href={DASHBOARD_PROMOTIONS_PATH}
      prefetch={false}
      scroll={false}
      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-violet-800/55 bg-violet-950/35 px-3 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-600/60 hover:bg-violet-950/50"
    >
      {DASHBOARD_SHOP_UPGRADES_LABEL}
    </Link>
  );

  const unreadN = effectiveNotifications?.unreadCount ?? notificationsUnreadCount;
  const supportStaffBadgeCount = supportNewFromStaffCount;

  useEffect(() => {
    const len = effectiveNotifications?.rows?.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(len / DASHBOARD_NOTIFICATIONS_PAGE_SIZE));
    setNotificationsPage((p) => Math.min(p, totalPages));
  }, [notifications?.rows?.length]);

  const notificationsPaging = useMemo(() => {
    const rows = effectiveNotifications?.rows ?? [];
    const totalPages = Math.max(1, Math.ceil(rows.length / DASHBOARD_NOTIFICATIONS_PAGE_SIZE));
    const page = Math.min(notificationsPage, totalPages);
    const start = (page - 1) * DASHBOARD_NOTIFICATIONS_PAGE_SIZE;
    return {
      pageRows: rows.slice(start, start + DASHBOARD_NOTIFICATIONS_PAGE_SIZE),
      totalPages,
      page,
      showPager: rows.length > DASHBOARD_NOTIFICATIONS_PAGE_SIZE,
    };
  }, [effectiveNotifications?.rows, notificationsPage]);

  type ShopDashboardTabEntry = { id: string; node: ReactNode };
  const shopDashboardTabItems: ShopDashboardTabEntry[] = [];
  if (hasNotifications) {
    shopDashboardTabItems.push({
      id: "notifications",
      node: tabBtn(
        "notifications",
        <span className="inline-flex items-center gap-2">
          Notifications
          {unreadN > 0 ? <span className={navTabCountBadgeCircleClass}>{unreadN}</span> : null}
        </span>,
        notificationsTabId,
        notificationsPanelId,
      ),
    });
  }
  if (hasSetup && setup) {
    shopDashboardTabItems.push(
      {
        id: "shopProfile",
        node: tabBtn("shopProfile", "Shop profile", shopProfileTabId, shopProfilePanelId),
      },
      {
        id: "requestListing",
        node: tabBtn("requestListing", "Request listing", requestListingTabId, requestListingPanelId),
      },
    );
  }
  shopDashboardTabItems.push(
    {
      id: "listings",
      node: tabBtn("listings", "Listings", listingsTabId, listingsPanelId),
    },
    {
      id: "orders",
      node: tabBtn("orders", "Sales", ordersTabId, ordersPanelId),
    },
  );
  if (canSupport) {
    shopDashboardTabItems.push({
      id: "support",
      node: tabBtn(
        "support",
        <span className="inline-flex items-center gap-2">
          Support
          {supportStaffBadgeCount > 0 ? (
            <span className="rounded-full bg-violet-900/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-violet-100">
              {supportStaffBadgeCount}
            </span>
          ) : null}
        </span>,
        supportTabId,
        supportPanelId,
      ),
    });
  }
  if (!isPlatform && shopAccount) {
    shopDashboardTabItems.push({
      id: "accountInfo",
      node: tabBtn("accountInfo", "Account info", accountInfoTabId, accountInfoPanelId),
    });
  }
  if (!isPlatform) {
    shopDashboardTabItems.push({ id: "shop-upgrades", node: promotionsPageBtn() });
  }

  const renderShopDashboardTabs = (entries: ShopDashboardTabEntry[]) =>
    entries.map(({ id, node }) => <Fragment key={id}>{node}</Fragment>);

  useEffect(() => {
    const container = shopDashboardTabsContainerRef.current;
    const measure = shopDashboardTabsMeasureRef.current;
    if (!container || !measure) return;

    const updateLayout = () => {
      const available = container.clientWidth;
      const needed = measure.scrollWidth;
      const comfortPx = 16;
      setShopDashboardTabsStacked(needed > Math.max(0, available - comfortPx));
    };

    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [
    shopDashboardTabItems.length,
    unreadN,
    supportStaffBadgeCount,
    activeTab,
    hasNotifications,
    hasSetup,
    canSupport,
    isPlatform,
    shopAccount != null,
  ]);

  return (
    <section className="mt-8">
      {listingSubmittedFlash ? (
        <p className="mb-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200/90">
          Listing submitted.
        </p>
      ) : null}
      {clientTabFetch && tabFetch.tabLoadError ? (
        <p className="mb-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200/90">
          {tabFetch.tabLoadError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {hasSetup && setup && showOnboardingTab ? (
          <div
            className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-1"
            role="tablist"
            aria-label="Shop onboarding"
          >
            <Fragment key="setup">{tabBtn("setup", "Onboarding", setupTabId, setupPanelId)}</Fragment>
            {!guidelinesAcknowledged ? (
              <Fragment key="itemGuidelines">
                {tabBtn("itemGuidelines", "Shop regulations", itemGuidelinesTabId, itemGuidelinesPanelId)}
              </Fragment>
            ) : null}
          </div>
        ) : null}
        <div
          ref={shopDashboardTabsContainerRef}
          className={`relative w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/40 ${
            shopDashboardTabsStacked ? "p-0.5" : "p-1"
          }`}
          role="tablist"
          aria-label="Shop dashboard"
        >
          <div
            ref={shopDashboardTabsMeasureRef}
            className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden"
            aria-hidden
          >
            <div className="inline-flex flex-nowrap items-center">
              {renderShopDashboardTabs(shopDashboardTabItems)}
            </div>
          </div>
          {shopDashboardTabsStacked ? (
            <div className="flex flex-col [&_a]:px-2 [&_a]:py-1 [&_a]:text-xs [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
              <div className="grid grid-cols-4 pb-0.5">
                {shopDashboardTabItems.slice(0, 4).map(({ id, node }) => (
                  <div key={id} className="flex min-w-0 items-center justify-center">
                    {node}
                  </div>
                ))}
              </div>
              {shopDashboardTabItems.length > 4 ? (
                <>
                  <div className="border-t border-zinc-800/80" aria-hidden />
                  <div className="grid grid-cols-4 pt-0.5">
                    {shopDashboardTabItems.slice(4).map(({ id, node }) => (
                      <div key={id} className="flex min-w-0 items-center justify-center">
                        {node}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex w-full min-w-0 flex-nowrap items-center justify-between">
              {renderShopDashboardTabs(shopDashboardTabItems)}
            </div>
          )}
        </div>
      </div>

      {hasSetup && setup && showOnboardingTab ? (
        <div
          id={setupPanelId}
          role="tabpanel"
          aria-labelledby={setupTabId}
          hidden={activeTab !== "setup"}
          className="pt-6"
        >
          {activeTab === "setup" ? (
            <ShopSetupTabsLazy
              key={setup.setupTabsKey}
              shop={setup.shop}
              steps={setup.steps}
              embedded
            />
          ) : null}
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={shopProfilePanelId}
          role="tabpanel"
          aria-labelledby={shopProfileTabId}
          hidden={activeTab !== "shopProfile"}
          className="pt-6"
        >
          {activeTab === "shopProfile" ? (
            <ShopProfileSetupPanelLazy
              key={setup.setupTabsKey}
              shop={setup.shop}
              r2Configured={setup.r2Configured}
              stripePublishableKey={stripePublishableKey}
              mockListingFeeCheckout={mockListingFeeCheckout}
              moderationPhrases={effectiveModerationPhrases}
              embedded
            />
          ) : null}
        </div>
      ) : null}

      {hasSetup && setup && showOnboardingTab && !guidelinesAcknowledged ? (
        <div
          id={itemGuidelinesPanelId}
          role="tabpanel"
          aria-labelledby={itemGuidelinesTabId}
          hidden={activeTab !== "itemGuidelines"}
          className="pt-6"
        >
          {activeTab === "itemGuidelines" ? (
            <ShopItemGuidelinesPanelLazy
              key={setup.setupTabsKey}
              acknowledged={setup.itemGuidelinesAcknowledged}
              onAcknowledged={handleGuidelinesAcknowledged}
              embedded
            />
          ) : null}
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={requestListingPanelId}
          role="tabpanel"
          aria-labelledby={requestListingTabId}
          hidden={activeTab !== "requestListing"}
          className="pt-6"
        >
          {clientTabFetch && tabFetch.failedTabs.requestListingCatalog ? (
            <DashboardTabLoadFailed
              message="Could not load the listing catalog. Your listing may still have been saved — open the Listings tab or try again."
              onRetry={() => tabFetch.retryTab("requestListingCatalog")}
            />
          ) : !effectiveLoadedFlags.requestListingCatalog ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading catalog…
            </div>
          ) : activeTab === "requestListing" ? (
            <ShopFirstListingRequestPanelLazy
              catalogGroups={setup.catalogGroups}
              r2Configured={setup.r2Configured}
              listingPickerDiagnostics={setup.listingPickerDiagnostics}
              draftListingRequestPrefill={draftListingRequestPrefill}
              needsListingCreditForNextRequest={setup.needsListingCreditForNextRequest}
              unpaidPublicationFeeListings={setup.unpaidPublicationFeeListings}
              freeListingSlots={setup.freeListingSlots}
              mockListingFeeCheckout={mockListingFeeCheckout}
              stripePublishableKey={stripePublishableKey}
              moderationPhrases={effectiveModerationPhrases}
              onListingSubmittedSuccess={afterListingSubmitted}
              knownListingCount={effectiveListings.length}
              embedded
            />
          ) : null}
        </div>
      ) : null}

      {hasSetup && setup ? (
        <div
          id={bugFeedbackPanelId}
          role="region"
          aria-label="Bug reports and feedback"
          hidden={activeTab !== "bugFeedback"}
          className="pt-6"
        >
          {activeTab === "bugFeedback" ? <BugFeedbackPanelLazy embedded /> : null}
        </div>
      ) : null}

      {!isPlatform && shopAccount ? (
        <div
          id={accountInfoPanelId}
          role="tabpanel"
          aria-labelledby={accountInfoTabId}
          hidden={activeTab !== "accountInfo"}
          className="pt-6"
        >
          {activeTab === "accountInfo" ? (
            <DashboardShopAccountPanelLazy
              initialEmail={shopAccount.email}
              emailVerified={shopAccount.emailVerified}
              twoFactorEmailEnabled={shopAccount.twoFactorEmailEnabled}
              accountDeletionRequestedAt={shopAccount.accountDeletionRequestedAt}
              accountDeletionEmailConfirmedAt={shopAccount.accountDeletionEmailConfirmedAt}
              stripeConnectAccountId={shopAccount.stripeConnectAccountId}
              stripeConnectBalance={shopAccount.stripeConnectBalance}
            />
          ) : null}
        </div>
      ) : null}

      <div
        id={listingsPanelId}
        role="tabpanel"
        aria-labelledby={listingsTabId}
        hidden={activeTab !== "listings"}
        className="pt-4"
      >
        {clientTabFetch && tabFetch.failedTabs.listings ? (
          activeTab === "listings" ? (
            <DashboardTabLoadFailed
              message="Could not load your listings. Try again, or refresh the page."
              onRetry={() => tabFetch.retryTab("listings")}
            />
          ) : null
        ) : !effectiveLoadedFlags.listings ? (
          activeTab === "listings" ? (
          <div className="flex items-center gap-2 py-10 text-sm text-zinc-500">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
              aria-hidden
            />
            Loading listings…
          </div>
          ) : null
        ) : activeTab === "listings" ? (
          <>
        {groupedRequest.length > 0 ? (
          <ListingsTabExpandSection
            className="mt-6"
            title="In review & listing setup"
            titleClassName="text-zinc-500"
            badgeCount={groupedRequest.length}
          >
            <ul className="mt-3 space-y-3">
              {groupedRequest.map((g) => (
                <ListingCard
                  key={g.row.id}
                  listing={g.row}
                  isPlatform={isPlatform}
                  shopSlug={shopSlug}
                  listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
                  r2Configured={r2Configured}
                  shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
                  stripePublishableKey={stripePublishableKey}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                  moderationKeywordPhrases={effectiveModerationPhrases}
                />
              ))}
            </ul>
          </ListingsTabExpandSection>
        ) : null}

        {groupedLive.length > 0 ? (
          <ListingsTabExpandSection
            className="mt-6"
            title="Live"
            titleClassName="text-emerald-500/90"
            badgeCount={groupedLive.length}
            blurb="Active on your public storefront right now."
          >
            <ul className="mt-3 space-y-3">
              {groupedLive.map((g) => (
                <ListingCard
                  key={g.row.id}
                  listing={g.row}
                  isPlatform={isPlatform}
                  shopSlug={shopSlug}
                  listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
                  r2Configured={r2Configured}
                  shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
                  stripePublishableKey={stripePublishableKey}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                  moderationKeywordPhrases={effectiveModerationPhrases}
                />
              ))}
            </ul>
          </ListingsTabExpandSection>
        ) : null}

        {groupedRemoved.length > 0 ? (
          <ListingsTabExpandSection
            className="mt-6"
            title="Removed"
            titleClassName="text-red-400/95"
            badgeCount={groupedRemoved.length}
            blurb={
              <>
                Listings that do not (or will not) appear on your storefront.
              </>
            }
          >
            <ul className="mt-3 space-y-3">
              {groupedRemoved.map((g) => (
                <ListingCard
                  key={g.row.id}
                  listing={g.row}
                  isPlatform={isPlatform}
                  shopSlug={shopSlug}
                  listingFeeBonusFreeSlots={listingFeeBonusFreeSlots}
                  r2Configured={r2Configured}
                  shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
                  stripePublishableKey={stripePublishableKey}
                  mockListingFeeCheckout={mockListingFeeCheckout}
                  moderationKeywordPhrases={effectiveModerationPhrases}
                />
              ))}
            </ul>
          </ListingsTabExpandSection>
        ) : null}

        {effectiveListings.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            No listings yet. Open the <strong className="text-zinc-400">Request listing</strong> tab to choose a
            catalog item, set your price, and upload artwork for admin review.
          </p>
        ) : null}
          </>
        ) : null}
      </div>

      {hasNotifications ? (
        <div
          id={notificationsPanelId}
          role="tabpanel"
          aria-labelledby={notificationsTabId}
          hidden={activeTab !== "notifications"}
          className="pt-6"
        >
          {!effectiveLoadedFlags.notifications ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading notifications…
            </div>
          ) : effectiveNotifications ? (
            <>
              <ul className="space-y-3">
                {notificationsPaging.pageRows.map((n) => {
                  const isUnread = n.readAt == null;
                  return (
                    <li
                      key={n.id}
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        isUnread
                          ? "border-sky-900/50 bg-sky-950/15 text-sky-100/90"
                          : "border-zinc-800 bg-zinc-950/30 text-zinc-400"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                        <DashboardNoticeBody
                          body={n.body}
                          className="min-w-0 flex-1 leading-snug"
                        />
                        {isUnread ? (
                          <DashboardNoticeMarkReadForm
                            noticeId={n.id}
                            onMarkedRead={() => handleNoticeMarkedRead(n.id)}
                          />
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] text-zinc-600">
                        <time dateTime={n.createdAt}>{formatNoticeWhen(n.createdAt)}</time>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {notificationsPaging.showPager ? (
                <nav
                  className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-4 text-xs text-zinc-500"
                  aria-label="Notification list pages"
                >
                  <span className="tabular-nums">
                    Page {notificationsPaging.page} of {notificationsPaging.totalPages}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={notificationsPaging.page <= 1}
                      onClick={() => setNotificationsPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={notificationsPaging.page >= notificationsPaging.totalPages}
                      onClick={() =>
                        setNotificationsPage((p) =>
                          Math.min(notificationsPaging.totalPages, p + 1),
                        )
                      }
                      className="rounded border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </nav>
              ) : null}
              {effectiveNotifications.rows.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No notifications yet.</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {canSupport ? (
        <div
          id={supportPanelId}
          role="tabpanel"
          aria-labelledby={supportTabId}
          hidden={activeTab !== "support"}
          className="pt-6"
        >
          {!effectiveLoadedFlags.support ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
                aria-hidden
              />
              Loading support…
            </div>
          ) : activeTab === "support" ? (
            <DashboardSupportChatPanelLazy
              messages={effectiveSupportChat?.messages ?? []}
              resolvedAtIso={effectiveSupportChat?.resolvedAtIso ?? null}
              onMessageSent={refreshSupportChat}
            />
          ) : null}
        </div>
      ) : null}

      <div
        id={ordersPanelId}
        role="tabpanel"
        aria-labelledby={ordersTabId}
        hidden={activeTab !== "orders"}
        className="pt-6"
      >
        {!effectiveLoadedFlags.orders ? (
          <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500/90"
              aria-hidden
            />
            Loading orders…
          </div>
        ) : (
            <>
        {activeTab === "orders" && showDemoPurchaseButton ? <DemoShopPurchaseButtonLazy /> : null}
        {effectivePaidOrders.length > 0 ? (
          <>
            <div
              className="mt-4 flex items-baseline justify-between gap-4 border-b border-zinc-800/80 pb-2 text-[11px] uppercase tracking-wide text-zinc-500"
              aria-hidden
            >
              <div className="flex min-w-0 flex-1 items-baseline gap-3">
                <span className="w-14 shrink-0 text-center">Date</span>
                <span className="min-w-0 flex-1 pl-4 text-left">Item</span>
              </div>
              <span className="min-w-[5.5rem] shrink-0 text-center text-blue-400">Shop profit</span>
            </div>
            <ul className="mt-2 space-y-3">
              {effectivePaidOrders.map((o) => (
                <li key={o.id} className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <time
                        dateTime={paidOrderDateTimeAttr(o.createdAt)}
                        className="w-14 shrink-0 font-normal tabular-nums text-zinc-300"
                      >
                        {formatPaidOrderDate(o.createdAt)}
                      </time>
                      <ul className="min-w-0 flex-1 space-y-2 text-zinc-400">
                        {o.lines.map((l, i) => (
                          <li key={i} className="leading-snug text-zinc-300">
                            {l.lineDisplayLabel} × {l.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {(() => {
                      const merch = paidOrderMerchandiseTotals(o);
                      return (
                        <PaidOrderShopProfitHelp
                          shopProfitCents={paidOrderShopProfitCents(o)}
                          saleCents={merch.saleCents}
                          goodsServicesCostCents={merch.goodsServicesCostCents}
                          platformCutCents={merch.platformCutCents}
                        />
                      );
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-600">No paid orders for this shop yet.</p>
        )}
          </>
        )}
      </div>
    </section>
  );
}
