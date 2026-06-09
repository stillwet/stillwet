import { itemCostUnitCents } from "@/lib/item-cost-cents";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";

export type BaselineCatalogRowForItemCost = {
  itemGoodsServicesCostCents: number;
  itemProductionFeeCents?: number;
};

/** Unit COGS in cents from the admin baseline catalog for a shop listing. */
export function baselineCogsUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  catalogRow: BaselineCatalogRowForItemCost | null | undefined;
}): number {
  const pick = parseBaselinePick(params.baselineCatalogPickEncoded ?? "");
  if (!pick || !params.catalogRow) return 0;
  return Math.max(0, params.catalogRow.itemGoodsServicesCostCents);
}

/** Unit production fee in cents from the admin baseline catalog for a shop listing. */
export function baselineProductionFeeUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  catalogRow: BaselineCatalogRowForItemCost | null | undefined;
}): number {
  const pick = parseBaselinePick(params.baselineCatalogPickEncoded ?? "");
  if (!pick || !params.catalogRow) return 0;
  return Math.max(0, params.catalogRow.itemProductionFeeCents ?? 0);
}

/** Shop-facing unit item cost (COGS + production fee) from baseline catalog. */
export function baselineItemCostUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  catalogRow: BaselineCatalogRowForItemCost | null | undefined;
}): number {
  return itemCostUnitCents(
    baselineCogsUnitCents(params),
    baselineProductionFeeUnitCents(params),
  );
}

/** @deprecated Use {@link baselineCogsUnitCents} — returns COGS only, not full item cost. */
export function baselineGoodsServicesUnitCents(params: {
  baselineCatalogPickEncoded: string | null | undefined;
  catalogRow: BaselineCatalogRowForItemCost | null | undefined;
}): number {
  return baselineCogsUnitCents(params);
}
