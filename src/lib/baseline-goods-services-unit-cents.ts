import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

export type BaselineCatalogRowForGoodsServices = {
  itemGoodsServicesCostCents: number;
};

/**
 * Unit goods/services (fulfillment COGS) in cents from the admin baseline catalog for a shop listing.
 * Non-baseline listings return 0.
 */
export function baselineGoodsServicesUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  catalogRow: BaselineCatalogRowForGoodsServices | null | undefined;
}): number {
  const pick = parseBaselinePick(params.baselineCatalogPickEncoded ?? "");
  if (!pick || !params.catalogRow) return 0;
  return Math.max(0, params.catalogRow.itemGoodsServicesCostCents);
}
