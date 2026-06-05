import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import { baselineGoodsServicesUnitCents } from "@/lib/baseline-goods-services-unit-cents";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

export type AdminCatalogRowForDisplay = {
  itemGoodsServicesCostCents: number;
};

export function formatMoneyServer(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Orders tab: shop listing title, then admin catalog product name in parentheses. */
export function dashboardPaidOrderLineDisplayLabel(line: {
  productName: string;
  product: { name: string } | null;
  shopListing: { requestItemName: string | null } | null;
}): string {
  const adminLabel = (line.product?.name ?? line.productName).trim() || line.productName;
  const shopLabel = line.shopListing?.requestItemName?.trim() ?? "";
  if (!shopLabel || shopLabel === adminLabel) {
    return adminLabel;
  }
  return `${shopLabel} (${adminLabel})`;
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

/** Unit COGS for profit estimates on a listing (same rules as checkout). */
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
  return baselineGoodsServicesUnitCents({
    baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
    catalogRow: row,
  });
}
