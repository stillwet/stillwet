"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getShopOwnerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import {
  LISTING_REQUEST_IN_REVIEW_STATUSES,
  shopCanSubmitAnotherListingRequest,
  shopInReviewListingRequestLimitError,
} from "@/lib/listing-request-review-limit";
import {
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
  SHOP_LISTING_MAX_PRICE_CENTS,
  shopListingMaxPriceUsdLabel,
} from "@/lib/marketplace-constants";
import { getListingOrdinal, syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import {
  deleteShopListingSupplementObject,
  deleteShopListingSupplementPendingObject,
  isR2UploadConfigured,
  listingSupplementImageUrlToObjectKey,
  listingSupplementPendingImageUrlToObjectKey,
  putPublicR2Object,
  shopListingSupplementPendingImageObjectKey,
} from "@/lib/r2-upload";
import { notifyAdminCreatorRemovedListingFromShop } from "@/lib/admin-creator-removed-listing-inbox-notice";
import { purgeShopListingR2Media } from "@/lib/shop-listing-r2-purge";
import { compressShopListingSupplementPhotoWebp } from "@/lib/shop-setup-image";
import { fulfillListingFeeForShopListingIfUnpaid } from "@/lib/listing-fee-fulfillment";
import { ensureListingFeeStripeConnectNotice } from "@/lib/listing-fee-connect-notice";
import { platformStripeConnectAccountCountryCode } from "@/lib/platform-checkout-limits";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { printifyVariantShopFloorCents } from "@/lib/listing-cart-price";
import { listingCatalogUrlsForPersist } from "@/lib/product-media";
import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";
import {
  resolveStripeConnectWebsiteOrigin,
  stripeConnectAccountLinkCreateParams,
  syncStripeConnectAccountPrefill,
} from "@/lib/stripe-connect-account-prefill";
import { normalizeSearchKeywords, SEARCH_KEYWORDS_MAX } from "@/lib/search-keywords-normalize";
import {
  buildListingTextHaystack,
  findModerationMatches,
  loadModerationKeywordPhrases,
  moderationTriggerErrorMessage,
} from "@/lib/moderation-keyword-scan";
import { revalidatePublicStorefront } from "@/lib/revalidate-public-storefront";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const REQUEST_ITEM_NAME_MAX = 120;
/** `ShopListing.storefrontItemBlurb` — one-line pitch on the public PDP (tweet-length cap). */
const STOREFRONT_ITEM_BLURB_MAX = 280;
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

export type DashboardUpdateListingPriceResult = { ok: true } | { ok: false; error: string };

export async function dashboardUpdateListingPrice(
  formData: FormData,
): Promise<DashboardUpdateListingPriceResult> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const dollars = String(formData.get("priceDollars") ?? "").trim();
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing can't be edited." };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return {
      ok: false,
      error:
        "Price can't be changed while this request is in review. Wait for approval, or finish editing your draft.",
    };
  }

  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: "Enter a valid USD amount." };
  }
  const cents = Math.round(parsed * 100);
  const p = listing.product;
  const minCents = printifyVariantShopFloorCents(p);
  if (cents < minCents) {
    return {
      ok: false,
      error: `Price must be at least ${formatUsdFromCents(minCents)} for this item.`,
    };
  }
  if (cents > SHOP_LISTING_MAX_PRICE_CENTS) {
    return {
      ok: false,
      error: `Price cannot exceed ${shopListingMaxPriceUsdLabel()} per listing.`,
    };
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { priceCents: cents },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  return { ok: true };
}

export type DashboardUpdateListingTextFieldResult =
  | { ok: true }
  | { ok: false; error: string };

export async function dashboardUpdateListingItemName(
  formData: FormData,
): Promise<DashboardUpdateListingTextFieldResult> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const raw = String(formData.get("requestItemName") ?? "");
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing can't be edited." };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return { ok: false, error: "This listing can't be edited right now." };
  }

  const trimmed = raw.trim();
  const catalog = listing.product.name.trim();
  let requestItemName: string | null;
  if (!trimmed || trimmed === catalog) {
    requestItemName = null;
  } else if (trimmed.length > REQUEST_ITEM_NAME_MAX) {
    return { ok: false, error: `Item name must be ${REQUEST_ITEM_NAME_MAX} characters or fewer.` };
  } else {
    requestItemName = trimmed;
  }

  const moderationPhrases = await loadModerationKeywordPhrases(prisma);
  const listingHaystack = buildListingTextHaystack({
    requestItemName,
    storefrontItemBlurb: listing.storefrontItemBlurb,
    listingSearchKeywords: listing.listingSearchKeywords,
  });
  const moderationHits = findModerationMatches(listingHaystack, moderationPhrases);
  if (moderationHits.length > 0) {
    return { ok: false, error: moderationTriggerErrorMessage(moderationHits) };
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { requestItemName },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  const pslug = listing.product.slug;
  revalidatePath(`/product/${pslug}`);
  revalidatePath(`/s/${user.shop.slug}/product/${pslug}`);
  revalidatePath(`/embed/product/${pslug}`);
  revalidatePublicStorefront();
  return { ok: true };
}

export async function dashboardUpdateListingStorefrontBlurb(
  formData: FormData,
): Promise<DashboardUpdateListingTextFieldResult> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const raw = String(formData.get("storefrontItemBlurb") ?? "");
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing can't be edited." };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return { ok: false, error: "This listing can't be edited right now." };
  }

  const trimmed = raw.trim();
  if (trimmed.length > STOREFRONT_ITEM_BLURB_MAX) {
    return { ok: false, error: `Storefront pitch must be ${STOREFRONT_ITEM_BLURB_MAX} characters or fewer.` };
  }
  const storefrontItemBlurb = trimmed.length === 0 ? null : trimmed;

  const moderationPhrases = await loadModerationKeywordPhrases(prisma);
  const listingHaystack = buildListingTextHaystack({
    requestItemName: listing.requestItemName,
    storefrontItemBlurb,
    listingSearchKeywords: listing.listingSearchKeywords,
  });
  const moderationHits = findModerationMatches(listingHaystack, moderationPhrases);
  if (moderationHits.length > 0) {
    return { ok: false, error: moderationTriggerErrorMessage(moderationHits) };
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { storefrontItemBlurb },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  const pslug = listing.product.slug;
  revalidatePath(`/product/${pslug}`);
  revalidatePath(`/s/${user.shop.slug}/product/${pslug}`);
  revalidatePath(`/embed/product/${pslug}`);
  revalidatePublicStorefront();
  return { ok: true };
}

export async function dashboardUpdateListingSearchKeywords(
  formData: FormData,
): Promise<DashboardUpdateListingTextFieldResult> {
  const user = await requireShopOwner();
  const listingId = String(formData.get("listingId") ?? "").trim();
  const raw = String(formData.get("listingSearchKeywords") ?? "");
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing can't be edited." };
  }
  if (
    listing.requestStatus !== ListingRequestStatus.draft &&
    listing.requestStatus !== ListingRequestStatus.approved
  ) {
    return { ok: false, error: "This listing can't be edited right now." };
  }

  const trimmed = raw.trim();
  if (trimmed.length > SEARCH_KEYWORDS_MAX) {
    return { ok: false, error: `Keywords must be ${SEARCH_KEYWORDS_MAX} characters or fewer.` };
  }
  const listingSearchKeywords = normalizeSearchKeywords(raw);

  const moderationPhrases = await loadModerationKeywordPhrases(prisma);
  const listingHaystack = buildListingTextHaystack({
    requestItemName: listing.requestItemName,
    storefrontItemBlurb: listing.storefrontItemBlurb,
    listingSearchKeywords,
  });
  const moderationHits = findModerationMatches(listingHaystack, moderationPhrases);
  if (moderationHits.length > 0) {
    return { ok: false, error: moderationTriggerErrorMessage(moderationHits) };
  }

  await prisma.shopListing.update({
    where: { id: listingId },
    data: { listingSearchKeywords },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  const pslug = listing.product.slug;
  revalidatePath(`/product/${pslug}`);
  revalidatePath(`/s/${user.shop.slug}/product/${pslug}`);
  revalidatePath(`/embed/product/${pslug}`);
  revalidatePublicStorefront();
  return { ok: true };
}

/** Takes an approved, live listing off the creator storefront (distinct from admin freeze). */
export async function dashboardCreatorRemoveListingFromShop(formData: FormData): Promise<void> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: {
      id: true,
      requestStatus: true,
      active: true,
      adminRemovedFromShopAt: true,
      creatorRemovedFromShopAt: true,
      requestItemName: true,
      listingPrintifyProductId: true,
      listingPrintifyVariantId: true,
      requestImages: true,
      listingStorefrontCatalogImageUrls: true,
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          imageGallery: true,
        },
      },
    },
  });
  if (!listing) return;
  if (listing.requestStatus !== ListingRequestStatus.approved) return;
  if (!listing.active) return;
  if (listing.adminRemovedFromShopAt != null) return;
  if (listing.creatorRemovedFromShopAt != null) return;

  await purgeShopListingR2Media({
    shopId: shop.id,
    listingId,
    requestImages: listing.requestImages,
    listingStorefrontCatalogImageUrls: listing.listingStorefrontCatalogImageUrls,
    product: listing.product,
  });

  const removedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.shopListing.update({
      where: { id: listingId },
      data: {
        active: false,
        featuredOnShop: false,
        featuredForHome: false,
        creatorRemovedFromShopAt: removedAt,
        requestImages: [],
        listingStorefrontCatalogImageUrls: Prisma.DbNull,
        adminListingSecondaryImageUrl: null,
        ownerSupplementImageUrl: null,
        ownerSupplementPendingImageUrl: null,
        ownerSupplementPendingSubmittedAt: null,
      },
    });
    await tx.product.update({
      where: { id: listing.product.id },
      data: {
        imageUrl: null,
        imageGallery: Prisma.JsonNull,
      },
    });
    if (shop.homeFeaturedListingId === listingId) {
      await tx.shop.update({
        where: { id: shop.id },
        data: { homeFeaturedListingId: null },
      });
    }
  });

  await notifyAdminCreatorRemovedListingFromShop({
    shop: { slug: shop.slug, displayName: shop.displayName },
    listing: {
      id: listingId,
      requestItemName: listing.requestItemName,
      listingPrintifyProductId: listing.listingPrintifyProductId,
      listingPrintifyVariantId: listing.listingPrintifyVariantId,
      catalogProductName: listing.product.name,
    },
    removedAt,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
}

export type DashboardSubmitListingRequestResult =
  | { ok: true }
  | { ok: false; error?: string };

export async function dashboardSubmitListingRequest(
  formData: FormData,
): Promise<DashboardSubmitListingRequestResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  const listingId = String(formData.get("listingId") ?? "").trim();
  const imagesText = String(formData.get("requestImageUrls") ?? "");
  if (!listingId) return { ok: false, error: "Missing listing." };
  if (String(formData.get("guidelinesAttestation") ?? "").trim() !== "1") {
    return {
      ok: false,
      error:
        "Confirm in the dialog that you have rights to your reference images and that they follow the shop regulations.",
    };
  }

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.requestStatus !== ListingRequestStatus.draft) {
    return { ok: false, error: "Only drafts can be submitted for review." };
  }
  if (listing.creatorRemovedFromShopAt != null) {
    return { ok: false, error: "This listing cannot be submitted." };
  }

  const inReviewCount = await prisma.shopListing.count({
    where: {
      shopId: shop.id,
      requestStatus: { in: [...LISTING_REQUEST_IN_REVIEW_STATUSES] },
    },
  });
  if (!shopCanSubmitAnotherListingRequest(inReviewCount)) {
    return { ok: false, error: shopInReviewListingRequestLimitError() };
  }

  const moderationPhrases = await loadModerationKeywordPhrases(prisma);
  const listingHaystack = buildListingTextHaystack({
    requestItemName: listing.requestItemName,
    storefrontItemBlurb: listing.storefrontItemBlurb,
    listingSearchKeywords: listing.listingSearchKeywords,
  });
  const moderationHits = findModerationMatches(listingHaystack, moderationPhrases);
  if (moderationHits.length > 0) {
    return { ok: false, error: moderationTriggerErrorMessage(moderationHits) };
  }

  await syncFreeListingFeeWaivers(shop.id);
  const listingAfterSync = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: user.shopId },
    select: { listingFeePaidAt: true },
  });
  const feePaid = listingAfterSync?.listingFeePaidAt != null;
  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal !== null) {
    const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);
    if (feeCents > 0 && !feePaid) {
      revalidatePath("/dashboard");
      return {
        ok: false,
        error:
          "You need listing credits to publish more listings. Buy a listing credit pack on the Request listing tab, then try again.",
      };
    }
  }

  const urls = imagesText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);

  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      requestStatus: ListingRequestStatus.submitted,
      requestImages: urls.length ? urls : undefined,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function dashboardPayListingFee(formData: FormData) {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const listingId = String(formData.get("listingId") ?? "").trim();
  if (!listingId) return;

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: {
      id: true,
      listingFeePaidAt: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
    },
  });
  if (!listing || listing.listingFeePaidAt) return;
  if (listing.creatorRemovedFromShopAt != null) return;
  if (listing.adminRemovedFromShopAt != null) return;

  const canPayListingFee =
    listing.requestStatus === ListingRequestStatus.draft ||
    listing.requestStatus === ListingRequestStatus.approved ||
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created;
  if (!canPayListingFee) return;

  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal === null) return;
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);

  if (feeCents === 0) {
    await fulfillListingFeeForShopListingIfUnpaid(listingId, {
      paidPublicationFeeCents: 0,
    });
    redirect("/dashboard?fee=ok");
  }

  if (isMockCheckoutEnabled()) {
    await fulfillListingFeeForShopListingIfUnpaid(listingId, {
      paidPublicationFeeCents: feeCents,
    });
    redirect("/dashboard?fee=ok");
  }

  redirect("/dashboard?fee=err&reason=listing_credits_required");
}

export type StartListingFeePaymentIntentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string };

export async function startListingFeePaymentIntent(
  listingId: string,
): Promise<StartListingFeePaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  const id = listingId.trim();
  if (!id) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id, shopId: shop.id },
    select: {
      id: true,
      listingFeePaidAt: true,
      requestStatus: true,
      creatorRemovedFromShopAt: true,
      adminRemovedFromShopAt: true,
    },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.listingFeePaidAt) return { ok: false, error: "This listing fee is already paid." };
  if (listing.creatorRemovedFromShopAt != null || listing.adminRemovedFromShopAt != null) {
    return { ok: false, error: "This listing cannot be charged." };
  }

  const canPayListingFee =
    listing.requestStatus === ListingRequestStatus.draft ||
    listing.requestStatus === ListingRequestStatus.approved ||
    listing.requestStatus === ListingRequestStatus.submitted ||
    listing.requestStatus === ListingRequestStatus.images_ok ||
    listing.requestStatus === ListingRequestStatus.printify_item_created;
  if (!canPayListingFee) {
    return { ok: false, error: "Publication fees can only be paid for eligible listing rows." };
  }

  const ordinal = await getListingOrdinal(id, shop.id);
  if (ordinal === null) return { ok: false, error: "Listing not found." };
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);
  if (feeCents <= 0) return { ok: false, error: "No publication fee is due for this listing." };

  if (!isMockCheckoutEnabled()) {
    return {
      ok: false,
      error:
        "Per-listing card payment is no longer available. Buy a listing credit pack on the Request listing tab.",
    };
  }

  return {
    ok: false,
    error: "Mock checkout is enabled — use the mock pay button instead of card entry.",
  };
}

export type FinalizeListingFeePaymentIntentResult = { ok: true } | { ok: false; error: string };

export async function finalizeListingFeePaymentIntent(
  paymentIntentId: string,
): Promise<FinalizeListingFeePaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId);

  if (pi.metadata?.kind !== "listing_fee") {
    return { ok: false, error: "This payment is not a listing publication fee." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const listingId = pi.metadata.shopListingId;
  if (!listingId) return { ok: false, error: "Invalid payment metadata." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    select: { id: true, listingFeePaidAt: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.listingFeePaidAt) return { ok: true };

  const ordinal = await getListingOrdinal(listingId, shop.id);
  if (ordinal === null) return { ok: false, error: "Listing not found." };
  const feeCents = listingFeeCentsForOrdinal(ordinal, shop.slug, shop.listingFeeBonusFreeSlots ?? 0);
  if (feeCents <= 0) return { ok: false, error: "No fee is configured for this listing." };
  if (pi.amount !== feeCents) {
    return { ok: false, error: "Payment amount does not match the current publication fee." };
  }

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }

  await fulfillListingFeeForShopListingIfUnpaid(listingId, {
    paidPublicationFeeCents: pi.amount,
  });
  return { ok: true };
}

export async function dashboardStartStripeConnect() {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) return;

  const base = publicAppBaseUrl();
  if (!base) redirect("/dashboard?connect=err&reason=no_app_url");

  try {
    const stripe = getStripe();
    const country = platformStripeConnectAccountCountryCode();
    const prefillInput = {
      shopId: shop.id,
      shopSlug: shop.slug,
      shopDisplayName: shop.displayName,
      ownerEmail: user.email,
      appOrigin: resolveStripeConnectWebsiteOrigin(),
      country,
    };

    const { accountId, account } = await syncStripeConnectAccountPrefill(
      stripe,
      shop.stripeConnectAccountId,
      prefillInput,
    );
    if (!shop.stripeConnectAccountId) {
      await prisma.shop.update({
        where: { id: shop.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const link = await stripe.accountLinks.create(
      stripeConnectAccountLinkCreateParams(account, {
        accountId,
        refreshUrl: `${base}/dashboard?connect=refresh`,
        returnUrl: `${base}/dashboard?connect=return`,
      }),
    );

    redirect(link.url);
  } catch (e) {
    rethrowNextNavigationError(e);
    console.error("[dashboardStartStripeConnect] failed", e);
    redirect("/dashboard?dash=setup&connect=err&reason=stripe_link");
  }
}

type ListingSupplementActionResult = { ok: true } | { ok: false; error: string };

function listingEligibleForOwnerSupplementPhoto(listing: {
  requestStatus: ListingRequestStatus;
  creatorRemovedFromShopAt: Date | null;
  adminRemovedFromShopAt: Date | null;
}): boolean {
  if (listing.requestStatus !== ListingRequestStatus.approved) return false;
  if (listing.creatorRemovedFromShopAt != null) return false;
  if (listing.adminRemovedFromShopAt != null) return false;
  return true;
}

export async function dashboardUploadListingSupplementPhoto(
  formData: FormData,
): Promise<ListingSupplementActionResult> {
  void formData;
  return { ok: false, error: "Custom listing photos are no longer available." };
}

export async function dashboardWithdrawListingSupplementPending(
  formData: FormData,
): Promise<ListingSupplementActionResult> {
  void formData;
  return { ok: false, error: "Custom listing photos are no longer available." };
}

export async function dashboardClearListingSupplementPhoto(
  formData: FormData,
): Promise<ListingSupplementActionResult> {
  void formData;
  return { ok: false, error: "Custom listing photos are no longer available." };
}

export type ListingCatalogImagesFormState = {
  ok: boolean;
  error: string | null;
};

type ApplyCatalogImagesResult = { ok: true } | { ok: false; error: string };

async function applyListingStorefrontCatalogImages(
  formData: FormData,
): Promise<ApplyCatalogImagesResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const listingId = String(formData.get("listingId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "subset").trim();
  if (!listingId) return { ok: false, error: "Missing listing." };

  const listing = await prisma.shopListing.findFirst({
    where: { id: listingId, shopId: shop.id },
    include: { product: true },
  });
  if (!listing) return { ok: false, error: "Listing not found." };
  if (
    listing.requestStatus === ListingRequestStatus.rejected ||
    listing.creatorRemovedFromShopAt != null
  ) {
    return { ok: false, error: "This listing cannot be updated." };
  }
  if (listing.requestStatus !== ListingRequestStatus.approved) {
    return { ok: false, error: "Only approved listings can change storefront images." };
  }
  if (listing.adminRemovedFromShopAt != null) {
    return { ok: false, error: "This listing is frozen and cannot be edited." };
  }

  if (mode === "all") {
    await prisma.shopListing.update({
      where: { id: listingId },
      data: { listingStorefrontCatalogImageUrls: Prisma.DbNull },
    });
  } else {
    const urls = formData
      .getAll("catalogUrl")
      .map((v) => String(v).trim())
      .filter(Boolean);
    const cleaned = listingCatalogUrlsForPersist(listing.product, urls, listing.ownerSupplementImageUrl);
    await prisma.shopListing.update({
      where: { id: listingId },
      data: { listingStorefrontCatalogImageUrls: cleaned },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath(`/s/${shop.slug}/product/${listing.product.slug}`);
  revalidatePublicStorefront();
  return { ok: true };
}

/** For `useActionState` on the dashboard listing card catalog image forms. */
export async function dashboardSetListingStorefrontCatalogImagesForm(
  _prev: ListingCatalogImagesFormState,
  formData: FormData,
): Promise<ListingCatalogImagesFormState> {
  try {
    const r = await applyListingStorefrontCatalogImages(formData);
    if (r.ok) return { ok: true, error: null };
    return { ok: false, error: r.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** @deprecated Prefer {@link dashboardSetListingStorefrontCatalogImagesForm} with useActionState */
export async function dashboardSetListingStorefrontCatalogImages(formData: FormData): Promise<void> {
  await applyListingStorefrontCatalogImages(formData);
}
