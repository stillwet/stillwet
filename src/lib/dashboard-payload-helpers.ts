import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import {
  baselineGoodsServicesUnitCents,
  baselineItemCostUnitCents,
} from "@/lib/baseline-goods-services-unit-cents";
import { effectiveListingItemDisplayName } from "@/lib/moderation-keyword-scan";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

export type AdminCatalogRowForDisplay = {
  itemGoodsServicesCostCents: number;
  itemProductionFeeCents?: number;
};

export function formatMoneyServer(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Orders tab: shop listing title only (no admin catalog type suffix). */
export function dashboardPaidOrderLineDisplayLabel(line: {
  productName: string;
  product: { name: string } | null;
  shopListing: { requestItemName: string | null } | null;
}): string {
  const catalogName = (line.product?.name ?? line.productName).trim() || line.productName;
  return effectiveListingItemDisplayName(line.shopListing?.requestItemName, catalogName);
}

/** Uses current admin baseline catalog + listing pick (same as checkout). */
export function paidOrderLineGoodsServicesDisplayCents(
  line: {
    unitPriceCents: number;
    quantity: number;
    goodsServicesCostCents: number;
    printifyVariantId: string | null;
    shopListing: { baselineCatalogPickEncoded: string | null } | null;
  },
  adminCatalogById: Map<string, AdminCatalogRowForDisplay>,
): number {
  const pick = parseBaselinePick(line.shopListing?.baselineCatalogPickEncoded ?? "");
  if (!pick) return line.goodsServicesCostCents;
  const row = adminCatalogById.get(pick.itemId);
  if (!row) return line.goodsServicesCostCents;
  const unit = baselineGoodsServicesUnitCents({
    baselineCatalogPickEncoded: line.shopListing?.baselineCatalogPickEncoded,
    catalogRow: row,
  });
  const merch = line.unitPriceCents * line.quantity;
  return Math.min(merch, Math.max(0, unit) * line.quantity);
}

/** Unit item cost (COGS + production fee) for profit estimates — same rules as checkout. */
export function listingGoodsServicesUnitCents(
  listing: {
    baselineCatalogPickEncoded: string | null;
    product: {
      fulfillmentType: FulfillmentType;
      printifyVariantId: string | null;
      priceCents: number;
    };
  },
  adminCatalogById: Map<string, AdminCatalogRowForDisplay>,
): number {
  const pick = parseBaselinePick(listing.baselineCatalogPickEncoded ?? "");
  const row = pick ? adminCatalogById.get(pick.itemId) : undefined;
  if (!row) return 0;
  return baselineItemCostUnitCents({
    baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
    catalogRow: row,
  });
}
