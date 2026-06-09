import { checkoutApplicationFeeCents } from "@/lib/checkout-tip";
import { orderLineItemCostCents, platformMerchandiseRetentionLineCents } from "@/lib/item-cost-cents";

export type OrderLineProceedsSplit = {
  unitPriceCents: number;
  quantity: number;
  goodsServicesCostCents: number;
  productionFeeCents?: number | null;
  platformCutCents: number;
  shopCutCents: number;
};

/** Shop profit for one persisted order line (merchandise only). */
export function orderLineShopProfitCents(line: Pick<OrderLineProceedsSplit, "shopCutCents">): number {
  return Math.max(0, line.shopCutCents);
}

/** Sum of persisted shop cuts across merchandise lines. */
export function orderShopMerchandiseProfitCents(
  lines: ReadonlyArray<Pick<OrderLineProceedsSplit, "shopCutCents">>,
): number {
  return lines.reduce((sum, line) => sum + orderLineShopProfitCents(line), 0);
}

/** Shop share of optional cart tip (full tip amount). */
export function orderShopTipShareCents(tipCents: number): number {
  const tip = Math.max(0, Math.round(tipCents));
  return tip;
}

/** Creator shop profit: merchandise shop cut + shop tip share. */
export function orderShopProfitCents(input: {
  lines: ReadonlyArray<Pick<OrderLineProceedsSplit, "shopCutCents">>;
  tipCents?: number | null;
  /** When set, used directly instead of deriving from `tipCents`. */
  shopTipShareCents?: number | null;
}): number {
  const merch = orderShopMerchandiseProfitCents(input.lines);
  if (input.shopTipShareCents != null && Number.isFinite(input.shopTipShareCents)) {
    return merch + Math.max(0, input.shopTipShareCents);
  }
  return merch + orderShopTipShareCents(input.tipCents ?? 0);
}

/** Platform merchandise retention for one line (COGS + production fee + marketplace fee). */
export function orderLinePlatformMerchandiseTakeCents(
  line: Pick<OrderLineProceedsSplit, "goodsServicesCostCents" | "productionFeeCents" | "platformCutCents">,
): number {
  return platformMerchandiseRetentionLineCents(line);
}

export function orderMerchandiseSaleCents(
  line: Pick<OrderLineProceedsSplit, "unitPriceCents" | "quantity">,
): number {
  return Math.max(0, line.unitPriceCents) * Math.max(0, line.quantity);
}

/** Merchandise line totals for breakdown UI (persisted cents). */
export function orderLineMerchandiseBreakdownCents(line: OrderLineProceedsSplit): {
  saleCents: number;
  goodsServicesCostCents: number;
  productionFeeCents: number;
  itemCostCents: number;
  platformCutCents: number;
  shopCutCents: number;
} {
  const productionFeeCents = Math.max(0, line.productionFeeCents ?? 0);
  return {
    saleCents: orderMerchandiseSaleCents(line),
    goodsServicesCostCents: Math.max(0, line.goodsServicesCostCents),
    productionFeeCents,
    itemCostCents: orderLineItemCostCents(line),
    platformCutCents: Math.max(0, line.platformCutCents),
    shopCutCents: Math.max(0, line.shopCutCents),
  };
}

export function orderMerchandiseBreakdownTotals(
  lines: ReadonlyArray<OrderLineProceedsSplit>,
): {
  saleCents: number;
  goodsServicesCostCents: number;
  productionFeeCents: number;
  itemCostCents: number;
  platformCutCents: number;
  shopCutCents: number;
} {
  return lines.reduce(
    (acc, line) => {
      const row = orderLineMerchandiseBreakdownCents(line);
      return {
        saleCents: acc.saleCents + row.saleCents,
        goodsServicesCostCents: acc.goodsServicesCostCents + row.goodsServicesCostCents,
        productionFeeCents: acc.productionFeeCents + row.productionFeeCents,
        itemCostCents: acc.itemCostCents + row.itemCostCents,
        platformCutCents: acc.platformCutCents + row.platformCutCents,
        shopCutCents: acc.shopCutCents + row.shopCutCents,
      };
    },
    {
      saleCents: 0,
      goodsServicesCostCents: 0,
      productionFeeCents: 0,
      itemCostCents: 0,
      platformCutCents: 0,
      shopCutCents: 0,
    },
  );
}

/** Σ(COGS + production fee + platform fee) — merchandise portion of Connect application fee. */
export function orderConnectMerchandiseApplicationFeeCents(
  lines: ReadonlyArray<
    Pick<OrderLineProceedsSplit, "goodsServicesCostCents" | "productionFeeCents" | "platformCutCents">
  >,
): number {
  return lines.reduce((sum, line) => sum + orderLinePlatformMerchandiseTakeCents(line), 0);
}

/**
 * Expected Stripe Connect `application_fee_amount` for a merchandise checkout
 * (merchandise platform take + payment processing pass-through, including tip surcharge when tipped).
 */
export function orderConnectApplicationFeeCents(input: {
  lines: ReadonlyArray<
    Pick<OrderLineProceedsSplit, "goodsServicesCostCents" | "productionFeeCents" | "platformCutCents">
  >;
  tipCents?: number | null;
  paymentProcessingCents?: number | null;
}): number {
  const merchandiseApplicationFeeCents = orderConnectMerchandiseApplicationFeeCents(input.lines);
  const processing = Math.max(0, Math.round(input.paymentProcessingCents ?? 0));
  return (
    checkoutApplicationFeeCents({
      merchandiseApplicationFeeCents,
      tipCents: input.tipCents ?? 0,
    }) + processing
  );
}

export { orderLineItemCostCents } from "@/lib/item-cost-cents";
