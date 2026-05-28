"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import {
  promotionStripePaymentsAvailable,
  promotionUiUsesMockCheckout,
} from "@/lib/checkout-mock";
import { paymentIntentStartErrorMessage } from "@/lib/payment-intent-start-error";
import {
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import {
  ListingRequestStatus,
  PromotionKind,
  PromotionPurchaseStatus,
} from "@/generated/prisma/enums";
import { fulfillPromotionPurchasePaidIfPending } from "@/lib/promotion-fulfillment";
import { dashboardPromotionsUrl } from "@/lib/dashboard-promotions-path";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import {
  loadPromotionCheckoutSlotUiForKind,
  loadPromotionCheckoutSlotsByKind,
  rebuildShopPromotionsDashboardSnapshot,
  type PromotionCheckoutSlotsByKind,
} from "@/lib/dashboard-scoped-data";
import type { PromotionMonthlySlotUi } from "@/lib/promotion-dashboard-ui-types";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import {
  parsePromotionKind,
  promotionKindLabel,
  promotionKindRequiresListing,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import {
  countPromotionKindPaidSlotsThreePeriodsCached,
  purchaseOfferForChosenPlacementOffset,
  resolveHotItemPlacementOfferWithCounts,
  resolvePopularPlacementOfferWithCounts,
  resolveTopShopPlacementOfferWithCounts,
} from "@/lib/promotion-hot-item-policy";
import {
  HOT_ITEM_PLATFORM_PERIOD_CAP,
  POPULAR_ITEM_PLATFORM_PERIOD_CAP,
  TOP_SHOP_PLATFORM_PERIOD_CAP,
} from "@/lib/promotion-policy-shared";
import {
  getPromotionPeriodIndexContaining,
  promotionPeriodStartUtc,
} from "@/lib/promotion-period-pacific";

function parsePlacementPeriodOffset(raw: unknown): 0 | 1 | 2 | undefined {
  const s = String(raw ?? "").trim();
  if (s === "0" || s === "1" || s === "2") return Number(s) as 0 | 1 | 2;
  return undefined;
}

async function resolvePromotionPricing(
  kind: PromotionKind,
  placementPeriodOffset?: 0 | 1 | 2,
): Promise<{ ok: true; amountCents: number; eligibleFrom: Date | null } | { ok: false; error: string }> {
  const base = promotionPriceCentsForKind(kind);
  const now = new Date();
  const currentIdx = getPromotionPeriodIndexContaining(now);
  const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(currentIdx + o)) as [Date, Date, Date];

  const needsPlacementBatch =
    kind === PromotionKind.HOT_FEATURED_ITEM ||
    kind === PromotionKind.FEATURED_SHOP_HOME ||
    kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM ||
    (kind === PromotionKind.FRONT_PAGE_ITEM && base > 0);

  const filledCounts = needsPlacementBatch
    ? await countPromotionKindPaidSlotsThreePeriodsCached(kind, periodStarts)
    : null;

  if (kind === PromotionKind.HOT_FEATURED_ITEM && filledCounts) {
    if (placementPeriodOffset !== undefined) {
      const pick = purchaseOfferForChosenPlacementOffset(
        base,
        HOT_ITEM_PLATFORM_PERIOD_CAP,
        filledCounts,
        periodStarts,
        currentIdx,
        now,
        placementPeriodOffset,
      );
      if (!pick.ok) return pick;
      return { ok: true, amountCents: pick.amountCents, eligibleFrom: pick.eligibleFrom };
    }
    const r = await resolveHotItemPlacementOfferWithCounts(base, now, filledCounts);
    if ("error" in r.offer) return { ok: false, error: r.offer.error };
    return { ok: true, amountCents: r.offer.amountCents, eligibleFrom: r.offer.eligibleFrom };
  }
  if (kind === PromotionKind.FEATURED_SHOP_HOME && filledCounts) {
    if (placementPeriodOffset !== undefined) {
      const pick = purchaseOfferForChosenPlacementOffset(
        base,
        TOP_SHOP_PLATFORM_PERIOD_CAP,
        filledCounts,
        periodStarts,
        currentIdx,
        now,
        placementPeriodOffset,
      );
      if (!pick.ok) return pick;
      return { ok: true, amountCents: pick.amountCents, eligibleFrom: pick.eligibleFrom };
    }
    const r = await resolveTopShopPlacementOfferWithCounts(base, now, filledCounts);
    if ("error" in r.offer) return { ok: false, error: r.offer.error };
    return { ok: true, amountCents: r.offer.amountCents, eligibleFrom: r.offer.eligibleFrom };
  }
  if (kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM && filledCounts) {
    if (placementPeriodOffset !== undefined) {
      const pick = purchaseOfferForChosenPlacementOffset(
        base,
        POPULAR_ITEM_PLATFORM_PERIOD_CAP,
        filledCounts,
        periodStarts,
        currentIdx,
        now,
        placementPeriodOffset,
      );
      if (!pick.ok) return pick;
      return { ok: true, amountCents: pick.amountCents, eligibleFrom: pick.eligibleFrom };
    }
    const r = await resolvePopularPlacementOfferWithCounts(base, now, filledCounts);
    if ("error" in r.offer) return { ok: false, error: r.offer.error };
    return { ok: true, amountCents: r.offer.amountCents, eligibleFrom: r.offer.eligibleFrom };
  }
  /** Same two-week Pacific window + proration as Popular when a non-zero price exists (not currently in dashboard UI). */
  if (kind === PromotionKind.FRONT_PAGE_ITEM) {
    if (base <= 0) return { ok: true, amountCents: 0, eligibleFrom: null };
    if (!filledCounts) return { ok: false, error: "Invalid promotion price." };
    if (placementPeriodOffset !== undefined) {
      const pick = purchaseOfferForChosenPlacementOffset(
        base,
        POPULAR_ITEM_PLATFORM_PERIOD_CAP,
        filledCounts,
        periodStarts,
        currentIdx,
        now,
        placementPeriodOffset,
      );
      if (!pick.ok) return pick;
      return { ok: true, amountCents: pick.amountCents, eligibleFrom: pick.eligibleFrom };
    }
    const r = await resolvePopularPlacementOfferWithCounts(base, now, filledCounts);
    if ("error" in r.offer) return { ok: false, error: r.offer.error };
    return { ok: true, amountCents: r.offer.amountCents, eligibleFrom: r.offer.eligibleFrom };
  }
  return { ok: true, amountCents: base, eligibleFrom: null };
}

async function requireShopOwner() {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");
  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    include: { shop: true },
  });
  if (!user) {
    session.destroy();
    redirect("/dashboard/login");
  }
  return user;
}

async function assertShopListingLiveForPromotion(
  shopId: string,
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId },
    select: {
      active: true,
      requestStatus: true,
    },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (!listing.active || listing.requestStatus === ListingRequestStatus.rejected) {
    return { ok: false, error: "Choose a live listing from your storefront." };
  }
  return { ok: true };
}

export type StartPromotionPurchaseIntentResult =
  | { ok: true; clientSecret: string; purchaseId: string }
  | { ok: false; error: string };

export type StartPromotionCheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Stripe Checkout redirect — no embedded Stripe.js on the dashboard. */
export async function startPromotionCheckoutSession(input: {
  promotionKind: string;
  placementPeriodOffset: 0 | 1 | 2;
}): Promise<StartPromotionCheckoutSessionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const kind = parsePromotionKind(input.promotionKind);
  if (!kind) return { ok: false, error: "Invalid promotion type." };

  const placementPeriodOffset = normalizePlacementPeriodOffsetFromClient(input.placementPeriodOffset);
  if (placementPeriodOffset === undefined) {
    return { ok: false, error: "Choose a placement period." };
  }

  const priced = await resolvePromotionPricing(kind, placementPeriodOffset);
  if (!priced.ok) return { ok: false, error: priced.error };
  const { amountCents, eligibleFrom } = priced;
  if (amountCents <= 0) return { ok: false, error: "Invalid promotion price." };

  if (!promotionStripePaymentsAvailable()) {
    return {
      ok: false,
      error: promotionUiUsesMockCheckout(shop.slug)
        ? "Mock promotion checkout is enabled — use the demo pay button."
        : "Stripe is not configured on the server.",
    };
  }

  const base = publicAppBaseUrl();
  if (!base) return { ok: false, error: "App URL is not configured." };

  const purchase = await prisma.promotionPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      kind,
      shopListingId: null,
      amountCents,
      currency: "usd",
      status: PromotionPurchaseStatus.pending,
      eligibleFrom,
    },
  });

  try {
    const stripe = getStripe();
    const appBase = base.replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: promotionKindLabel(kind),
              description: "Shop promotion credit (Pacific placement period).",
            },
          },
        },
      ],
      metadata: {
        kind: "promotion_checkout",
        promotionPurchaseId: purchase.id,
        shopId: shop.id,
        promotionKind: kind,
        placementPeriodOffset: String(placementPeriodOffset),
        amountCents: String(amountCents),
        ...(eligibleFrom ? { eligibleFromIso: eligibleFrom.toISOString() } : {}),
      },
      success_url: `${appBase}${dashboardPromotionsUrl({ promo: "ok" })}`,
      cancel_url: `${appBase}${dashboardPromotionsUrl({ promo: "cancel" })}`,
    });

    if (!session.url) {
      await prisma.promotionPurchase.update({
        where: { id: purchase.id },
        data: { status: PromotionPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }

    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[startPromotionCheckoutSession]", e);
    await prisma.promotionPurchase.update({
      where: { id: purchase.id },
      data: { status: PromotionPurchaseStatus.failed },
    });
    return { ok: false, error: paymentIntentStartErrorMessage(e) };
  }
}

function normalizePlacementPeriodOffsetFromClient(
  v: unknown,
): 0 | 1 | 2 | undefined {
  const n = typeof v === "number" && Number.isInteger(v) ? v : Number(String(v ?? "").trim());
  if (n === 0 || n === 1 || n === 2) return n;
  return undefined;
}

export async function startPromotionPurchaseIntent(input: {
  promotionKind: string;
  shopListingId?: string | null;
  placementPeriodOffset?: 0 | 1 | 2;
}): Promise<StartPromotionPurchaseIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const kind = parsePromotionKind(input.promotionKind);
  if (!kind) return { ok: false, error: "Invalid promotion type." };

  const listingIdRaw = String(input.shopListingId ?? "").trim();
  if (!promotionKindRequiresListing(kind) && listingIdRaw) {
    return { ok: false, error: "This promotion applies to your shop, not a single listing." };
  }

  let shopListingId: string | null = null;
  if (listingIdRaw) {
    const gate = await assertShopListingLiveForPromotion(shop.id, listingIdRaw);
    if (!gate.ok) return gate;
    shopListingId = listingIdRaw;
  }

  const placementPeriodOffset = normalizePlacementPeriodOffsetFromClient(input.placementPeriodOffset);
  const priced = await resolvePromotionPricing(kind, placementPeriodOffset);
  if (!priced.ok) return { ok: false, error: priced.error };
  const { amountCents, eligibleFrom } = priced;
  if (amountCents <= 0) return { ok: false, error: "Invalid promotion price." };

  if (!promotionStripePaymentsAvailable()) {
    return {
      ok: false,
      error: promotionUiUsesMockCheckout(shop.slug)
        ? "Mock promotion checkout is enabled — use the demo pay button instead of card entry."
        : "Stripe is not configured on the server (set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).",
    };
  }

  const purchase = await prisma.promotionPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      kind,
      shopListingId,
      amountCents,
      currency: "usd",
      status: PromotionPurchaseStatus.pending,
      eligibleFrom,
    },
  });

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        kind: "promotion",
        promotionPurchaseId: purchase.id,
        shopId: shop.id,
        promotionKind: kind,
        ...(shopListingId ? { shopListingId } : {}),
        amountCents: String(amountCents),
        ...(eligibleFrom ? { eligibleFromIso: eligibleFrom.toISOString() } : {}),
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      await prisma.promotionPurchase.update({
        where: { id: purchase.id },
        data: { status: PromotionPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a client secret." };
    }

    await prisma.promotionPurchase.update({
      where: { id: purchase.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return { ok: true, clientSecret, purchaseId: purchase.id };
  } catch (e) {
    console.error("[startPromotionPurchaseIntent]", e);
    await prisma.promotionPurchase.update({
      where: { id: purchase.id },
      data: { status: PromotionPurchaseStatus.failed },
    });
    return { ok: false, error: paymentIntentStartErrorMessage(e) };
  }
}

export type FinalizePromotionPurchaseIntentResult = { ok: true } | { ok: false; error: string };

export async function finalizePromotionPurchaseIntent(
  paymentIntentId: string,
): Promise<FinalizePromotionPurchaseIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId, {
    expand: ["latest_charge"],
  });

  if (pi.metadata?.kind !== "promotion") {
    return { ok: false, error: "This payment is not a promotion purchase." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const purchaseId = pi.metadata.promotionPurchaseId;
  if (!purchaseId) return { ok: false, error: "Invalid payment metadata." };

  const purchase = await prisma.promotionPurchase.findFirst({
    where: { id: purchaseId, shopId: shop.id },
    select: {
      id: true,
      status: true,
      amountCents: true,
      kind: true,
    },
  });
  if (!purchase) return { ok: false, error: "Promotion purchase not found." };
  if (purchase.status === PromotionPurchaseStatus.paid) return { ok: true };

  if (purchase.status !== PromotionPurchaseStatus.pending) {
    return { ok: false, error: "This promotion purchase is no longer pending." };
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }

  if (pi.amount !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match the promotion price." };
  }

  const chargeRaw = pi.latest_charge;
  const chargeId =
    typeof chargeRaw === "string"
      ? chargeRaw
      : chargeRaw && typeof chargeRaw === "object" && "id" in chargeRaw
        ? String((chargeRaw as { id: string }).id)
        : null;

  await fulfillPromotionPurchasePaidIfPending(purchase.id, {
    paymentIntentId: pi.id,
    chargeId,
    paidAmountCents: pi.amount,
  });
  return { ok: true };
}

export async function dashboardMockPayPromotion(formData: FormData) {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const kind = parsePromotionKind(String(formData.get("promotionKind") ?? ""));
  if (!kind) return;

  const listingIdRaw = String(formData.get("shopListingId") ?? "").trim();
  const listingKind = promotionKindRequiresListing(kind);
  if (!listingKind && listingIdRaw) return;

  let shopListingId: string | null = null;
  if (listingIdRaw) {
    if (!listingKind) return;
    const gate = await assertShopListingLiveForPromotion(shop.id, listingIdRaw);
    if (!gate.ok) return;
    shopListingId = listingIdRaw;
  }

  if (!promotionUiUsesMockCheckout(shop.slug)) {
    redirect(dashboardPromotionsUrl({ promo: "err", promoErr: "mock_only" }));
  }

  const placementPeriodOffset = parsePlacementPeriodOffset(formData.get("placementPeriodOffset"));
  const priced = await resolvePromotionPricing(kind, placementPeriodOffset);
  if (!priced.ok) {
    redirect(dashboardPromotionsUrl({ promo: "err", promoErr: "hot_item_policy" }));
  }
  const { amountCents, eligibleFrom } = priced;
  if (amountCents <= 0) return;

  await prisma.promotionPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      kind,
      shopListingId,
      amountCents,
      currency: "usd",
      status: PromotionPurchaseStatus.paid,
      paidAt: new Date(),
      eligibleFrom,
    },
  });

  void rebuildShopPromotionsDashboardSnapshot(shop.id, shop.slug).catch(() => {});
  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
  redirect(dashboardPromotionsUrl({ promo: "ok" }));
}

export type FetchPromotionCheckoutContextResult =
  | {
      ok: true;
      slotUi: PromotionMonthlySlotUi;
      mockPromotionCheckout: boolean;
      stripePublishableKey: string | null;
    }
  | { ok: false; error: string };

/** Background prefetch for all checkout kinds (one DB query); does not block RSC tab load. */
export async function prefetchPromotionCheckoutSlots(): Promise<
  { ok: true; checkoutSlotByKind: PromotionCheckoutSlotsByKind } | { ok: false }
> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) return { ok: false };

  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { slug: true } } },
  });
  if (!row?.shop || row.shop.slug === PLATFORM_SHOP_SLUG) return { ok: false };

  try {
    const checkoutSlotByKind = await loadPromotionCheckoutSlotsByKind();
    return { ok: true, checkoutSlotByKind };
  } catch {
    return { ok: false };
  }
}

/** Fallback when prefetch is missing or user retries checkout pricing for one kind. */
export async function fetchPromotionCheckoutContext(
  kindRaw: string,
): Promise<FetchPromotionCheckoutContextResult> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) return { ok: false, error: "Unauthorized" };

  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { slug: true } } },
  });
  if (!row?.shop) return { ok: false, error: "Unauthorized" };
  if (row.shop.slug === PLATFORM_SHOP_SLUG) return { ok: false, error: "Forbidden" };

  const kind = parsePromotionKind(kindRaw);
  if (
    !kind ||
    (kind !== PromotionKind.HOT_FEATURED_ITEM &&
      kind !== PromotionKind.FEATURED_SHOP_HOME &&
      kind !== PromotionKind.MOST_POPULAR_OF_TAG_ITEM)
  ) {
    return { ok: false, error: "Invalid promotion kind" };
  }

  try {
    const payload = await loadPromotionCheckoutSlotUiForKind(kind, row.shop.slug);
    return { ok: true, ...payload };
  } catch {
    return { ok: false, error: "Checkout unavailable." };
  }
}
