"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { FulfillmentType, ListingRequestStatus } from "@/generated/prisma/enums";
import {
  LISTING_REQUEST_IN_REVIEW_STATUSES,
  shopCanSubmitAnotherListingRequest,
  shopInReviewListingRequestLimitError,
} from "@/lib/listing-request-review-limit";
import {
  deleteLegacyShopProfileAvatarKeys,
  deleteAllListingArtworkStagingForShop,
  deleteListingArtworkSource,
  deleteListingArtworkStaging,
  deleteR2ObjectsByKeys,
  getR2ObjectBuffer,
  isListingArtworkSourceKeyForShop,
  isListingArtworkStagingKeyForShop,
  isListingRequestArtworkKeyForShop,
  isR2UploadConfigured,
  listingRequestArtworkUrlToObjectKey,
  listR2ObjectKeysWithPrefix,
  loadListingArtworkStagingBuffer,
  publicUrlToR2ObjectKey,
  publicHttpsUrlForR2ObjectKey,
  putPublicR2Object,
  shopListingArtworkStagingObjectKey,
  shopListingRequestImageUrlStrings,
  shopProfileAvatarObjectKey,
  verifyListingArtworkStagingR2Write,
} from "@/lib/r2-upload";
import {
  listingArtworkUploadCapError,
  listingRequestArtworkStoredMaxMb,
  listingRequestArtworkStoredMaxBytes,
  listingRequestArtworkUploadMaxBytes,
  listingRequestArtworkUploadMaxMb,
} from "@/lib/listing-request-artwork-limits";
import { loadAdminCatalogItemArtworkPolicy } from "@/lib/admin-baseline-catalog-rows";
import { resolveListingArtworkLetterboxFill } from "@/lib/listing-artwork-letterbox-fill";
import {
  cropAndPrepareListingArtworkForStorage,
  prepareListingRequestArtworkForStorage,
  compressShopProfileImageWebp,
} from "@/lib/shop-setup-image";
import {
  shopSocialLinksFormValidationError,
  shopSocialLinksFromFormData,
} from "@/lib/shop-social-links";
import {
  PLATFORM_SHOP_SLUG,
  SHOP_LISTING_MAX_PRICE_CENTS,
  listingFeeCentsForOrdinal,
  shopListingMaxPriceUsdLabel,
} from "@/lib/marketplace-constants";
import {
  findShopIdConflictingDisplayName,
} from "@/lib/shop-display-name-uniqueness.server";
import { SHOP_DISPLAY_NAME_TAKEN_ERROR } from "@/lib/shop-display-name-uniqueness";
import { allocateUniqueShopSlug } from "@/lib/shop-slug";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import {
  createBaselineStubProductForNewListing,
  type BaselineStubPick,
} from "@/lib/shop-baseline-stub-product";
import { downgradeSubmittedToDraftIfListingFeeUnpaid } from "@/lib/listing-fee";
import { widthHeightPxFromImageBuffer } from "@/lib/artwork-image-dimensions";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";
import { syncProductTagsForNewBaselineListing } from "@/lib/baseline-listing-product-tags-sync";
import { normalizeSearchKeywords, SEARCH_KEYWORDS_MAX } from "@/lib/search-keywords-normalize";
import {
  buildListingTextHaystack,
  buildShopProfileHaystack,
  findModerationMatches,
  loadModerationKeywordPhrases,
  moderationTriggerErrorMessage,
} from "@/lib/moderation-keyword-scan";
import type { ShopSocialLinksRecord } from "@/lib/shop-social-links";
import { revalidatePublicStorefront } from "@/lib/revalidate-public-storefront";
import { plainTextNoUrlsValidationError } from "@/lib/plain-text-no-urls";
import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";
import {
  LISTING_UPLOAD_CRASH_ERROR,
  listingArtworkServerCropFailedError,
  listingArtworkServerProcessingError,
} from "@/lib/listing-request-submit-errors";
import { listingArtworkCropPayloadFromForm } from "@/lib/listing-artwork-crop-payload";

const WELCOME_MAX = 280;
const STOREFRONT_ITEM_BLURB_MAX = 280;
const REQUEST_ITEM_NAME_MAX = 120;

function parseRequestItemNameFromForm(
  formData: FormData,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = String(formData.get("requestItemName") ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Enter a name for this item." };
  }
  if (raw.length > REQUEST_ITEM_NAME_MAX) {
    return {
      ok: false,
      error: `Item name must be ${REQUEST_ITEM_NAME_MAX} characters or fewer.`,
    };
  }
  return { ok: true, value: raw };
}

export type ShopSetupActionResult =
  | { ok: true; message?: string; profileImageUrl?: string }
  | { ok: false; error: string };

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

export async function updateShopProfileSetup(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const welcomeRaw = String(formData.get("welcomeMessage") ?? "").trim();
  if (!displayName || displayName.length > 120) {
    return { ok: false, error: "Shop display name is required (max 120 characters)." };
  }

  if (await findShopIdConflictingDisplayName(displayName, shop.id)) {
    return { ok: false, error: SHOP_DISPLAY_NAME_TAKEN_ERROR };
  }

  const slugResult = await allocateUniqueShopSlug(displayName, shop.id);
  if ("error" in slugResult) {
    return { ok: false, error: slugResult.error };
  }
  const nextSlug = slugResult.slug;
  const oldSlug = shop.slug;
  if (welcomeRaw.length > WELCOME_MAX) {
    return { ok: false, error: `Welcome message must be ${WELCOME_MAX} characters or fewer.` };
  }
  const welcomeUrlErr = plainTextNoUrlsValidationError(welcomeRaw);
  if (welcomeUrlErr) {
    return { ok: false, error: welcomeUrlErr };
  }

  const socialFormErr = shopSocialLinksFormValidationError(formData);
  if (socialFormErr) {
    return { ok: false, error: socialFormErr };
  }

  const socialLinks = shopSocialLinksFromFormData(formData);
  const socialJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    Object.keys(socialLinks).length > 0
      ? (socialLinks as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  const moderationPhrases = await loadModerationKeywordPhrases(prisma);
  const profileHaystack = buildShopProfileHaystack({
    displayName,
    welcomeMessage: welcomeRaw || null,
    socialLinks: socialLinks as ShopSocialLinksRecord,
  });
  const moderationHits = findModerationMatches(profileHaystack, moderationPhrases);
  if (moderationHits.length > 0) {
    return { ok: false, error: moderationTriggerErrorMessage(moderationHits) };
  }

  try {
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        slug: nextSlug,
        displayName,
        welcomeMessage: welcomeRaw || null,
        socialLinks: socialJson,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      if (await findShopIdConflictingDisplayName(displayName, shop.id)) {
        return { ok: false, error: SHOP_DISPLAY_NAME_TAKEN_ERROR };
      }
      return {
        ok: false,
        error: "Could not save your shop profile. Try again, or pick a different shop name.",
      };
    }
    throw e;
  }
  revalidatePath("/dashboard");
  revalidatePath(`/s/${oldSlug}`);
  revalidatePath(`/s/${nextSlug}`);
  revalidatePath("/shops");
  revalidatePublicStorefront();
  return { ok: true };
}

/** Public directory opt-in: `/shops` and home “top shops” only when true. */
export async function updateShopListedOnShopsBrowseForm(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  const raw = String(formData.get("listedOnShopsBrowse") ?? "").trim().toLowerCase();
  const listed = raw === "1" || raw === "true" || raw === "yes";
  const unlisted = raw === "0" || raw === "false" || raw === "no";
  if (!listed && !unlisted) {
    return { ok: false, error: "Choose whether your store appears on the shops list." };
  }
  await prisma.shop.update({
    where: { id: shop.id },
    data: { listedOnShopsBrowse: listed },
  });
  revalidatePath("/dashboard");
  revalidatePath("/shops");
  revalidatePath("/");
  revalidatePublicStorefront();
  return { ok: true };
}

export async function acknowledgeShopItemGuidelines(): Promise<void> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return;
  }
  await prisma.shop.update({
    where: { id: shop.id },
    data: { itemGuidelinesAcknowledgedAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePublicStorefront();
}

export async function uploadShopProfileImageSetup(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const file = formData.get("profileImage");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return { ok: false, error: "Choose an image file to upload." };
  }
  if (file.size > 15 * 1024 * 1024) {
    return { ok: false, error: "Image is too large before processing (max 15 MB)." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const webp = await compressShopProfileImageWebp(buf);
  if (!webp) {
    return {
      ok: false,
      error: "Could not compress that image to under 100 KiB. Try a simpler photo.",
    };
  }

  const previousUrl = shop.profileImageUrl;
  const previousKey = previousUrl ? publicUrlToR2ObjectKey(previousUrl) : null;

  // Best-effort: remove any old rolling keys before writing the next one.
  // (We run this *before* upload so we never delete the new key by mistake.)
  await deleteLegacyShopProfileAvatarKeys(shop.id);
  // Best-effort: also remove the old canonical key used by earlier versions.
  await deleteR2ObjectsByKeys([shopProfileAvatarObjectKey(shop.id)]);

  const key = `shops/${shop.id}/avatar-${randomUUID()}.webp`;
  const url = await putPublicR2Object({
    key,
    body: webp,
    contentType: "image/webp",
  });
  // Best-effort: delete the previous avatar object (covers older `avatar.webp?v=...` URLs too).
  if (previousKey && previousKey.startsWith(`shops/${shop.id}/`) && previousKey !== key) {
    await deleteR2ObjectsByKeys([previousKey]);
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: { profileImageUrl: url },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/s/${shop.slug}`);
  revalidatePath("/shops");
  revalidatePublicStorefront();
  return { ok: true, profileImageUrl: url };
}

export type ListingArtworkStagingUploadResult =
  | { ok: true; stagingKey: string }
  | { ok: false; error: string };

function listingArtworkExtensionForContentType(contentType: string): string | null {
  const ct = contentType.toLowerCase().split(";")[0].trim();
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpeg";
  if (ct === "image/webp") return "webp";
  return null;
}

/** Browser PUT to R2 for artwork over the server-action body cap (Vercel ~4.5 MB). */
export async function createListingArtworkStagingUpload(
  contentType: string,
  byteSize: number,
): Promise<ListingArtworkStagingUploadResult> {
  const user = await requireShopOwner();
  if (!isR2UploadConfigured()) {
    return { ok: false, error: "Artwork upload is not configured on this server." };
  }
  const uploadMax = listingRequestArtworkUploadMaxBytes();
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return { ok: false, error: "Choose an artwork file to upload." };
  }
  if (byteSize > uploadMax) {
    return { ok: false, error: listingArtworkUploadCapError() };
  }
  if (!listingArtworkExtensionForContentType(contentType)) {
    return { ok: false, error: "Use a PNG, JPEG, or WebP artwork file." };
  }

  const writeCheck = await verifyListingArtworkStagingR2Write(user.shop.id);
  if (!writeCheck.ok) {
    return { ok: false, error: writeCheck.error };
  }

  const stagingKey = shopListingArtworkStagingObjectKey(user.shop.id);
  return { ok: true, stagingKey };
}

async function listingRequestArtworkKeyStillReferenced(
  shopId: string,
  objectKey: string,
  publicUrl?: string,
): Promise<boolean> {
  const listings = await prisma.shopListing.findMany({
    where: { shopId },
    select: { requestImages: true },
  });
  for (const listing of listings) {
    for (const url of shopListingRequestImageUrlStrings(listing.requestImages)) {
      if (publicUrl && url === publicUrl) return true;
      const key =
        listingRequestArtworkUrlToObjectKey(url, shopId) ?? publicUrlToR2ObjectKey(url);
      if (key === objectKey) return true;
    }
  }
  return false;
}

async function cleanupUnconfirmedListingRequestUpload(params: {
  shopId: string;
  stagingKey?: string | null;
  sourceKey?: string | null;
  requestImageKey?: string | null;
  requestImageUrl?: string | null;
  bakedRequestImageKey?: string | null;
}): Promise<void> {
  const stagingKey = params.stagingKey?.trim();
  if (stagingKey && isListingArtworkStagingKeyForShop(stagingKey, params.shopId)) {
    try {
      await deleteListingArtworkStaging(stagingKey);
    } catch (e) {
      console.error("[cleanupUnconfirmedListingRequestUpload] staging", e);
    }
  }

  const sourceKey = params.sourceKey?.trim();
  if (sourceKey && isListingArtworkSourceKeyForShop(sourceKey, params.shopId)) {
    try {
      await deleteListingArtworkSource(sourceKey);
    } catch (e) {
      console.error("[cleanupUnconfirmedListingRequestUpload] source", e);
    }
  }

  const requestImageKey =
    params.bakedRequestImageKey?.trim() || params.requestImageKey?.trim();
  if (!requestImageKey?.startsWith(`shops/${params.shopId}/listing-request/`)) {
    return;
  }
  try {
    if (await listingRequestArtworkKeyStillReferenced(params.shopId, requestImageKey, params.requestImageUrl ?? undefined)) {
      return;
    }
    await deleteR2ObjectsByKeys([requestImageKey]);
  } catch (e) {
    console.error("[cleanupUnconfirmedListingRequestUpload] request image", e);
  }
}

/** Client recovery: delete staged/orphan artwork when submit success could not be confirmed. */
export async function abandonUnconfirmedListingRequestSubmit(
  stagingKey?: string | null,
  bakedRequestImageKey?: string | null,
  sourceKey?: string | null,
): Promise<void> {
  const user = await requireShopOwner();
  const shopId = user.shop.id;
  await cleanupUnconfirmedListingRequestUpload({
    shopId,
    stagingKey,
    sourceKey,
    bakedRequestImageKey,
  });

  try {
    const prefix = `shops/${shopId}/listing-request/`;
    const keys = await listR2ObjectKeysWithPrefix(prefix);
    const orphanKeys: string[] = [];
    for (const key of keys) {
      if (!(await listingRequestArtworkKeyStillReferenced(shopId, key))) {
        orphanKeys.push(key);
      }
    }
    if (orphanKeys.length > 0) {
      await deleteR2ObjectsByKeys(orphanKeys);
    }
  } catch (e) {
    console.error("[abandonUnconfirmedListingRequestSubmit] orphan listing-request scan", e);
  }
}

export async function submitFirstListingSetup(
  formData: FormData,
): Promise<ShopSetupActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (String(formData.get("guidelinesAttestation") ?? "").trim() !== "1") {
    return {
      ok: false,
      error:
        "Confirm in the dialog that you have rights to your images and that they follow the shop regulations.",
    };
  }

  // Publication fees are based on *requests submitted*, not approvals.
  // Drafts do not count toward the free-slot ordinal.
  const existingSubmittedRequestCount = await prisma.shopListing.count({
    where: { shopId: shop.id, requestStatus: { not: ListingRequestStatus.draft } },
  });
  const nextListingOrdinal = existingSubmittedRequestCount + 1;
  const publicationFeeCentsForRequest = listingFeeCentsForOrdinal(
    nextListingOrdinal,
    shop.slug,
    shop.listingFeeBonusFreeSlots ?? 0,
  );
  if (publicationFeeCentsForRequest > 0) {
    return {
      ok: false,
      error:
        "You need listing credits to request another listing. Buy a listing credit pack on the Request listing tab first.",
    };
  }

  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error: "Image uploads are not configured (R2 env vars missing on the server).",
    };
  }

  const itemNameParsed = parseRequestItemNameFromForm(formData);
  if (!itemNameParsed.ok) {
    return { ok: false, error: itemNameParsed.error };
  }
  const requestItemName = itemNameParsed.value;

  const blurbRaw = String(formData.get("storefrontItemBlurb") ?? "").trim();
  if (blurbRaw.length > STOREFRONT_ITEM_BLURB_MAX) {
    return {
      ok: false,
      error: `Storefront pitch must be ${STOREFRONT_ITEM_BLURB_MAX} characters or fewer.`,
    };
  }
  const keywordsRaw = String(formData.get("listingSearchKeywords") ?? "");
  if (keywordsRaw.trim().length > SEARCH_KEYWORDS_MAX) {
    return { ok: false, error: `Keywords must be ${SEARCH_KEYWORDS_MAX} characters or fewer.` };
  }
  const storefrontItemBlurb = blurbRaw.length > 0 ? blurbRaw : null;
  const listingSearchKeywords = normalizeSearchKeywords(keywordsRaw);

  const moderationPhrases = await loadModerationKeywordPhrases(prisma);
  const listingHaystack = buildListingTextHaystack({
    requestItemName,
    storefrontItemBlurb,
    listingSearchKeywords,
  });
  const moderationHits = findModerationMatches(listingHaystack, moderationPhrases);
  if (moderationHits.length > 0) {
    return { ok: false, error: moderationTriggerErrorMessage(moderationHits) };
  }

  const pickRaw = String(formData.get("productId") ?? "").trim();
  const dollars = String(formData.get("listingPriceDollars") ?? "").trim();
  if (!pickRaw) {
    return { ok: false, error: "Select an allowed item from the list." };
  }

  const baselinePick = parseBaselinePick(pickRaw);

  if (baselinePick?.mode === "allVariants") {
    return {
      ok: false,
      error:
        "The listing catalog was updated. Refresh this page, then select your item again and resubmit.",
    };
  }

  let productId: string;
  let minCents: number;

  if (baselinePick) {
    const stub = await createBaselineStubProductForNewListing(
      shop.id,
      baselinePick as BaselineStubPick,
    );
    if (!stub) {
      return { ok: false, error: "That catalog item is not available." };
    }
    productId = stub.productId;
    minCents = stub.minPriceCents;
  } else {
    const product = await prisma.product.findFirst({
      where: {
        id: pickRaw,
        active: true,
        fulfillmentType: FulfillmentType.printify,
      },
      select: {
        id: true,
        minPriceCents: true,
        priceCents: true,
      },
    });
    if (!product) {
      return { ok: false, error: "That catalog item is not available." };
    }
    productId = product.id;
    minCents = product.minPriceCents > 0 ? product.minPriceCents : product.priceCents;
  }

  const maxLabel = shopListingMaxPriceUsdLabel();
  if (minCents > SHOP_LISTING_MAX_PRICE_CENTS) {
    return {
      ok: false,
      error: `This item's minimum price (${(minCents / 100).toFixed(2)} USD) is above the ${maxLabel} listing cap. Pick another product or contact support.`,
    };
  }

  const parsed = parseFloat(dollars.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: "Enter a valid list price." };
  }
  const priceCents = Math.round(parsed * 100);
  if (priceCents < minCents) {
    return {
      ok: false,
      error: `Price must be at least ${(minCents / 100).toFixed(2)} USD for this item.`,
    };
  }
  if (priceCents > SHOP_LISTING_MAX_PRICE_CENTS) {
    return {
      ok: false,
      error: `List price cannot exceed ${maxLabel} per listing.`,
    };
  }

  let printAreaW: number | null = null;
  let printAreaH: number | null = null;
  let catalogImageRequirementLabel: string | null = null;
  let letterboxFill = null as ReturnType<typeof resolveListingArtworkLetterboxFill> | null;

  if (baselinePick) {
    const adminItem = await loadAdminCatalogItemArtworkPolicy(baselinePick.itemId);
    catalogImageRequirementLabel = adminItem?.itemImageRequirementLabel?.trim() || null;
    const pw = adminItem?.itemPrintAreaWidthPx ?? null;
    const ph = adminItem?.itemPrintAreaHeightPx ?? null;
    if (pw != null && ph != null && pw > 0 && ph > 0) {
      printAreaW = pw;
      printAreaH = ph;
    }
    if (adminItem) {
      letterboxFill = resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: adminItem.itemArtworkLetterboxFill,
        itemLargeListingArtwork: adminItem.itemLargeListingArtwork,
        catalogItemName: adminItem.name,
        printAreaWidthPx: printAreaW,
        printAreaHeightPx: printAreaH,
      });
    }
  }

  const artworkUploadMaxBytes = listingRequestArtworkUploadMaxBytes();
  const artworkUploadMaxMb = listingRequestArtworkUploadMaxMb();
  const artworkStoredMaxMb = listingRequestArtworkStoredMaxMb();

  const bakedKeyRaw = String(formData.get("listingArtworkBakedKey") ?? "").trim();
  const bakedUrlRaw = String(formData.get("listingArtworkBakedUrl") ?? "").trim();
  const stagingKeyRaw = String(formData.get("listingArtworkStagingKey") ?? "").trim();
  let stagingKeyToDelete: string | null = null;
  let uploadedRequestImageKey: string | null = null;
  let uploadedRequestImageUrl: string | null = null;

  try {
  if (bakedKeyRaw) {
    if (!isListingRequestArtworkKeyForShop(bakedKeyRaw, shop.id)) {
      return { ok: false, error: "Invalid artwork reference. Crop and upload again." };
    }
    if (await listingRequestArtworkKeyStillReferenced(shop.id, bakedKeyRaw, bakedUrlRaw || undefined)) {
      return { ok: false, error: "That artwork is already used on a listing." };
    }

    const bakedBuf = await getR2ObjectBuffer(bakedKeyRaw);
    if (!bakedBuf || bakedBuf.length === 0) {
      return {
        ok: false,
        error: "Prepared artwork was not found. Open the crop dialog and try Upload + Crop again.",
      };
    }
    if (bakedBuf.length > listingRequestArtworkStoredMaxBytes()) {
      return {
        ok: false,
        error: `Prepared artwork exceeds the ${artworkStoredMaxMb} MB stored limit. Re-crop with a simpler design.`,
      };
    }

    if (printAreaW != null && printAreaH != null) {
      const outDims = await widthHeightPxFromImageBuffer(bakedBuf);
      if (!outDims || !exportedImageMeetsPrintDimensions(outDims.w, outDims.h, printAreaW, printAreaH)) {
        return {
          ok: false,
          error: catalogImageRequirementLabel
            ? `Artwork must be exactly ${printAreaW}×${printAreaH}px for this item (${catalogImageRequirementLabel}). Re-crop and try again.`
            : `Artwork must be exactly ${printAreaW}×${printAreaH}px for this item. Re-crop and try again.`,
        };
      }
    }

    uploadedRequestImageKey = bakedKeyRaw;
    uploadedRequestImageUrl = bakedUrlRaw || publicHttpsUrlForR2ObjectKey(bakedKeyRaw);
    if (!uploadedRequestImageUrl.trim()) {
      return {
        ok: false,
        error: "Prepared artwork URL is missing. Crop and upload again.",
      };
    }
  } else {
  let rawBuf: Buffer | null = null;
  let artwork: Awaited<ReturnType<typeof prepareListingRequestArtworkForStorage>> = null;
  let useServerCrop = false;

  if (stagingKeyRaw) {
    if (!isListingArtworkStagingKeyForShop(stagingKeyRaw, shop.id)) {
      return { ok: false, error: "Invalid artwork upload reference. Try uploading again." };
    }
    const staged = await loadListingArtworkStagingBuffer(stagingKeyRaw);
    if (!staged || staged.length === 0) {
      return {
        ok: false,
        error: "Uploaded artwork was not found. Try uploading again before you submit.",
      };
    }
    if (staged.length > artworkUploadMaxBytes) {
      return {
        ok: false,
        error: listingArtworkUploadCapError(),
      };
    }
    stagingKeyToDelete = stagingKeyRaw;

    useServerCrop = formData.get("listingArtworkServerCrop") === "1";
    if (useServerCrop) {
      const cropPayload = listingArtworkCropPayloadFromForm(formData);
      if (!cropPayload) {
        return {
          ok: false,
          error: "Invalid crop data. Open the crop dialog, adjust the crop, and try again.",
        };
      }
      artwork = await cropAndPrepareListingArtworkForStorage(
        staged,
        cropPayload,
        undefined,
        printAreaW,
        printAreaH,
        letterboxFill,
      );
      if (!artwork) {
        return {
          ok: false,
          error: listingArtworkServerCropFailedError(),
        };
      }
    } else {
      rawBuf = staged;
    }
  } else {
    return {
      ok: false,
      error:
        "Artwork upload did not finish. Refresh the page and submit again — your file uploads in the background before review.",
    };
  }

  if (!useServerCrop) {
    if (!rawBuf) {
      return {
        ok: false,
        error: "Uploaded artwork was not found. Try uploading again before you submit.",
      };
    }
    if (printAreaW != null && printAreaH != null) {
      const dims = await widthHeightPxFromImageBuffer(rawBuf);
      if (!dims) {
        return {
          ok: false,
          error: "Could not read image dimensions. Use a valid PNG or JPEG file.",
        };
      }
      if (!exportedImageMeetsPrintDimensions(dims.w, dims.h, printAreaW, printAreaH)) {
        return {
          ok: false,
          error: catalogImageRequirementLabel
            ? `Artwork must be exactly ${printAreaW}×${printAreaH}px for this item (${catalogImageRequirementLabel}). This file is ${dims.w}×${dims.h}px.`
            : `Artwork must be exactly ${printAreaW}×${printAreaH}px for this item. This file is ${dims.w}×${dims.h}px.`,
        };
      }
    }

    artwork = await prepareListingRequestArtworkForStorage(rawBuf, undefined, printAreaW, printAreaH);
    if (!artwork) {
      return {
        ok: false,
        error: printAreaW != null && printAreaH != null
          ? `Could not store artwork at ${printAreaW}×${printAreaH}px within ${artworkStoredMaxMb} MB. Try a simpler export or less noisy art — we do not shrink print dimensions to fit.`
          : `Could not use that artwork file. Upload a PNG or JPEG (or WebP) up to ${artworkUploadMaxMb} MB.`,
      };
    }
  }

  if (!artwork) {
    return {
      ok: false,
      error: listingArtworkServerCropFailedError(),
    };
  }

  if (printAreaW != null && printAreaH != null) {
    const outDims = await widthHeightPxFromImageBuffer(artwork.body);
    if (!outDims || !exportedImageMeetsPrintDimensions(outDims.w, outDims.h, printAreaW, printAreaH)) {
      return {
        ok: false,
        error: `Artwork must match the exact print pixel size for this item. Re-export as PNG or JPEG at that size and try again.`,
      };
    }
  }

  const key = `shops/${shop.id}/listing-request/${randomUUID()}.${artwork.fileExtension}`;
  uploadedRequestImageKey = key;
  uploadedRequestImageUrl = await putPublicR2Object({
    key,
    body: artwork.body,
    contentType: artwork.contentType,
  });
  }

  if (stagingKeyToDelete) {
    stagingKeyToDelete = null;
  }
  try {
    await deleteAllListingArtworkStagingForShop(shop.id);
  } catch (e) {
    console.error("[submitFirstListingSetup] staging cleanup", e);
  }

  const existing = await prisma.shopListing.findUnique({
    where: { shopId_productId: { shopId: shop.id, productId } },
  });
  if (existing) {
    if (existing.active || existing.requestStatus === ListingRequestStatus.approved) {
      await cleanupUnconfirmedListingRequestUpload({
        shopId: shop.id,
        requestImageKey: uploadedRequestImageKey,
        requestImageUrl: uploadedRequestImageUrl,
      });
      uploadedRequestImageKey = null;
      uploadedRequestImageUrl = null;
      return { ok: false, error: "That item is already live on your shop." };
    }
    if (
      existing.requestStatus === ListingRequestStatus.submitted ||
      existing.requestStatus === ListingRequestStatus.images_ok ||
      existing.requestStatus === ListingRequestStatus.printify_item_created
    ) {
      await cleanupUnconfirmedListingRequestUpload({
        shopId: shop.id,
        requestImageKey: uploadedRequestImageKey,
        requestImageUrl: uploadedRequestImageUrl,
      });
      uploadedRequestImageKey = null;
      uploadedRequestImageUrl = null;
      return {
        ok: false,
        error: "That item is already waiting for admin review. Pick another product or wait for a decision.",
      };
    }
  }

  const inReviewCount = await prisma.shopListing.count({
    where: {
      shopId: shop.id,
      requestStatus: { in: [...LISTING_REQUEST_IN_REVIEW_STATUSES] },
    },
  });
  if (!shopCanSubmitAnotherListingRequest(inReviewCount)) {
    await cleanupUnconfirmedListingRequestUpload({
      shopId: shop.id,
      requestImageKey: uploadedRequestImageKey,
      requestImageUrl: uploadedRequestImageUrl,
    });
    uploadedRequestImageKey = null;
    uploadedRequestImageUrl = null;
    return { ok: false, error: shopInReviewListingRequestLimitError() };
  }

  const listingCreateData = {
    shopId: shop.id,
    productId,
    priceCents,
    requestItemName,
    storefrontItemBlurb,
    listingSearchKeywords,
    requestImages: [uploadedRequestImageUrl],
    requestStatus: ListingRequestStatus.submitted,
    active: false,
    ...(baselinePick ? { baselineCatalogPickEncoded: pickRaw } : {}),
  };

  const saved = baselinePick
    ? await prisma.shopListing.create({ data: listingCreateData })
    : await prisma.shopListing.upsert({
        where: { shopId_productId: { shopId: shop.id, productId } },
        create: listingCreateData,
        update: {
          priceCents,
          requestItemName,
          storefrontItemBlurb,
          listingSearchKeywords,
          requestImages: [uploadedRequestImageUrl],
          requestStatus: ListingRequestStatus.submitted,
          active: false,
        },
      });

  if (baselinePick) {
    try {
      await syncProductTagsForNewBaselineListing({
        adminCatalogItemId: baselinePick.itemId,
        productId,
        shopSlug: shop.slug,
      });
    } catch (e) {
      console.error("[submitFirstListingSetup] baseline tag sync failed (listing still saved)", e);
    }
  }

  const gate = await downgradeSubmittedToDraftIfListingFeeUnpaid(
    shop.id,
    shop.slug,
    saved.id,
  );
  after(() => {
    try {
      revalidateAdminViews();
    } catch (e) {
      console.error("[submitFirstListingSetup] revalidateAdminViews failed", e);
    }
  });
  if (gate.downgraded && gate.message) {
    return { ok: true, message: gate.message };
  }
  uploadedRequestImageKey = null;
  uploadedRequestImageUrl = null;
  return { ok: true };
  } catch (e) {
    rethrowNextNavigationError(e);
    console.error("[submitFirstListingSetup]", e);
    await cleanupUnconfirmedListingRequestUpload({
      shopId: shop.id,
      stagingKey: stagingKeyToDelete,
      requestImageKey: uploadedRequestImageKey,
      requestImageUrl: uploadedRequestImageUrl,
    });
    const msg = e instanceof Error ? e.message : String(e);
    const imageProcessingFailure =
      /memory|alloc|heap|ENOMEM|process out of|sharp|vips|image exceeds pixel limit/i.test(msg);
    return {
      ok: false,
      error: imageProcessingFailure
        ? listingArtworkServerProcessingError(artworkStoredMaxMb)
        : LISTING_UPLOAD_CRASH_ERROR,
    };
  }
}
