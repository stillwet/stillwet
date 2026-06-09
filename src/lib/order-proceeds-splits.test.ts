import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitMerchandiseLineForCheckoutCents } from "@/lib/marketplace-fee";
import {
  orderConnectApplicationFeeCents,
  orderConnectMerchandiseApplicationFeeCents,
  orderMerchandiseBreakdownTotals,
  orderShopProfitCents,
} from "@/lib/order-proceeds-splits";

describe("orderShopProfitCents", () => {
  it("sums persisted shop cuts", () => {
    assert.equal(
      orderShopProfitCents({
        lines: [{ shopCutCents: 300 }, { shopCutCents: 150 }],
        tipCents: 0,
      }),
      450,
    );
  });

  it("includes full shop tip share when tip > 0", () => {
    assert.equal(
      orderShopProfitCents({
        lines: [{ shopCutCents: 400 }],
        tipCents: 100,
      }),
      500,
    );
  });

  it("uses shopTipShareCents directly when provided", () => {
    assert.equal(
      orderShopProfitCents({
        lines: [{ shopCutCents: 868 }],
        tipCents: 0,
        shopTipShareCents: 25,
      }),
      893,
    );
  });
});

describe("orderConnectMerchandiseApplicationFeeCents", () => {
  it("matches checkout merchandise application fee formula", () => {
    const split = splitMerchandiseLineForCheckoutCents({
      lineMerchandiseCents: 2000,
      goodsServicesLineCents: 800,
    });
    const lines = [
      {
        unitPriceCents: 2000,
        quantity: 1,
        goodsServicesCostCents: split.goodsServicesCostCents,
        platformCutCents: split.platformCutCents,
        shopCutCents: split.shopCutCents,
      },
    ];
    assert.equal(
      orderConnectMerchandiseApplicationFeeCents(lines),
      split.goodsServicesCostCents + split.platformCutCents,
    );
    assert.equal(
      orderConnectApplicationFeeCents({
        lines,
        tipCents: 100,
        paymentProcessingCents: 70,
      }),
      split.goodsServicesCostCents + split.platformCutCents + 70,
    );
  });
});

describe("orderMerchandiseBreakdownTotals", () => {
  it("preserves sale = goods + platform + shop identity", () => {
    const split = splitMerchandiseLineForCheckoutCents({
      lineMerchandiseCents: 1500,
      goodsServicesLineCents: 600,
    });
    const line = {
      unitPriceCents: 1500,
      quantity: 1,
      goodsServicesCostCents: split.goodsServicesCostCents,
      platformCutCents: split.platformCutCents,
      shopCutCents: split.shopCutCents,
    };
    const totals = orderMerchandiseBreakdownTotals([line]);
    assert.equal(
      totals.saleCents,
      totals.goodsServicesCostCents + totals.platformCutCents + totals.shopCutCents,
    );
    assert.equal(totals.shopCutCents, orderShopProfitCents({ lines: [line], tipCents: 0 }));
  });
});
