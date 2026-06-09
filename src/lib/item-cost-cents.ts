import { splitMerchandiseLineForCheckoutCents } from "@/lib/marketplace-fee";

/** Shop-facing item cost per unit (COGS + production fee). */
export function itemCostUnitCents(cogsUnitCents: number, productionFeeUnitCents: number): number {
  return Math.max(0, Math.round(cogsUnitCents)) + Math.max(0, Math.round(productionFeeUnitCents));
}

/** Shop-facing item cost for a line (unit × quantity, capped by line merchandise when needed). */
export function itemCostLineCents(input: {
  cogsUnitCents: number;
  productionFeeUnitCents: number;
  quantity: number;
  lineMerchandiseCents?: number;
}): { cogsLineCents: number; productionFeeLineCents: number; itemCostLineCents: number } {
  const quantity = Math.max(0, Math.round(input.quantity));
  const cogsRaw = Math.max(0, Math.round(input.cogsUnitCents)) * quantity;
  const productionRaw = Math.max(0, Math.round(input.productionFeeUnitCents)) * quantity;
  const itemCostRaw = cogsRaw + productionRaw;
  const cap =
    input.lineMerchandiseCents != null
      ? Math.max(0, Math.round(input.lineMerchandiseCents))
      : itemCostRaw;
  if (itemCostRaw <= cap) {
    return {
      cogsLineCents: cogsRaw,
      productionFeeLineCents: productionRaw,
      itemCostLineCents: itemCostRaw,
    };
  }
  const cogsLineCents = Math.min(cogsRaw, cap);
  const productionFeeLineCents = Math.min(productionRaw, cap - cogsLineCents);
  return {
    cogsLineCents,
    productionFeeLineCents,
    itemCostLineCents: cogsLineCents + productionFeeLineCents,
  };
}

/** Platform merchandise retention on one line (COGS + production fee + marketplace fee). */
export function platformMerchandiseRetentionLineCents(line: {
  goodsServicesCostCents: number;
  productionFeeCents?: number | null;
  platformCutCents: number;
}): number {
  return (
    Math.max(0, line.goodsServicesCostCents) +
    Math.max(0, line.productionFeeCents ?? 0) +
    Math.max(0, line.platformCutCents)
  );
}

/** Shop-facing item cost on one persisted order line. */
export function orderLineItemCostCents(line: {
  goodsServicesCostCents: number;
  productionFeeCents?: number | null;
}): number {
  return Math.max(0, line.goodsServicesCostCents) + Math.max(0, line.productionFeeCents ?? 0);
}

export function splitMerchandiseLineWithItemCostCents(params: {
  lineMerchandiseCents: number;
  cogsLineCents: number;
  productionFeeLineCents: number;
}): {
  goodsServicesCostCents: number;
  productionFeeCents: number;
  platformCutCents: number;
  shopCutCents: number;
} {
  const split = splitMerchandiseLineForCheckoutCents({
    lineMerchandiseCents: params.lineMerchandiseCents,
    goodsServicesLineCents: params.cogsLineCents + params.productionFeeLineCents,
  });
  return {
    goodsServicesCostCents: params.cogsLineCents,
    productionFeeCents: params.productionFeeLineCents,
    platformCutCents: split.platformCutCents,
    shopCutCents: split.shopCutCents,
  };
}
