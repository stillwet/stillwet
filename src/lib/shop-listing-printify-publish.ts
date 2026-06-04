import { ListingRequestStatus, FulfillmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  isPrintifyConfigured,
  setPrintifyProductPublishingSucceeded,
} from "@/lib/printify";

function resolvePrintifyProductId(
  listingPrintifyProductId: string | null | undefined,
  productPrintifyProductId: string | null | undefined,
): string | null {
  const fromListing = listingPrintifyProductId?.trim();
  if (fromListing) return fromListing;
  const fromProduct = productPrintifyProductId?.trim();
  return fromProduct || null;
}

/**
 * Marks a Printify catalog product as published for API/custom storefront fulfillment.
 * Best-effort: logs and returns on misconfiguration or API errors (does not throw).
 */
export async function ensurePrintifyProductPublishingSucceeded(
  printifyProductId: string,
): Promise<void> {
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!isPrintifyConfigured() || !shopId) return;

  const pid = printifyProductId.trim();
  if (!pid) return;

  const r = await setPrintifyProductPublishingSucceeded(shopId, pid);
  if (!r.ok) {
    console.error("[printify-publish] publishing_succeeded failed", {
      printifyProductId: pid,
      status: r.status,
      body: r.body,
    });
  }
}

/** When a shop listing goes live, tell Printify the linked product is published on StillWet. */
export async function ensurePrintifyPublishingSucceededWhenListingGoesLive(
  productId: string,
): Promise<void> {
  const listing = await prisma.shopListing.findFirst({
    where: { productId },
    select: {
      listingPrintifyProductId: true,
      product: {
        select: {
          fulfillmentType: true,
          printifyProductId: true,
        },
      },
    },
  });
  if (!listing || listing.product.fulfillmentType !== FulfillmentType.printify) return;

  const printifyProductId = resolvePrintifyProductId(
    listing.listingPrintifyProductId,
    listing.product.printifyProductId,
  );
  if (!printifyProductId) return;

  await ensurePrintifyProductPublishingSucceeded(printifyProductId);
}

/**
 * Backfill: every live approved listing with a Printify product id should be published in Printify.
 * Dedupes by Printify product id (multiple shop listings can share one Printify product).
 */
export async function reconcilePrintifyPublishingForAllLiveListings(): Promise<void> {
  if (!isPrintifyConfigured()) return;

  const listings = await prisma.shopListing.findMany({
    where: {
      active: true,
      requestStatus: ListingRequestStatus.approved,
      product: { fulfillmentType: FulfillmentType.printify },
      OR: [
        { listingPrintifyProductId: { not: null } },
        { product: { printifyProductId: { not: null } } },
      ],
    },
    select: {
      listingPrintifyProductId: true,
      product: { select: { printifyProductId: true } },
    },
  });

  const printifyProductIds = new Set<string>();
  for (const row of listings) {
    const pid = resolvePrintifyProductId(
      row.listingPrintifyProductId,
      row.product.printifyProductId,
    );
    if (pid) printifyProductIds.add(pid);
  }

  for (const printifyProductId of printifyProductIds) {
    await ensurePrintifyProductPublishingSucceeded(printifyProductId);
  }
}
