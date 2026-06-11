import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitMerchandiseLineWithItemCostCents } from "@/lib/item-cost-cents";
import {
  orderConnectApplicationFeeCents,
  orderConnectMerchandiseApplicationFeeCents,
  orderConnectShopTransferCents,
  orderConnectSplitVerification,
  orderMerchandiseBreakdownTotals,
  orderShopProfitCents,
} from "@/lib/order-proceeds-splits";
import { buyerPaymentProcessingFeeCents } from "@/lib/stripe-card-processing-fee";

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
  it("includes COGS, production fee, and platform cut", () => {
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: 2000,
      cogsLineCents: 700,
      productionFeeLineCents: 100,
    });
    const lines = [
      {
        unitPriceCents: 2000,
        quantity: 1,
        goodsServicesCostCents: split.goodsServicesCostCents,
        productionFeeCents: split.productionFeeCents,
        platformCutCents: split.platformCutCents,
        shopCutCents: split.shopCutCents,
      },
    ];
    assert.equal(
      orderConnectMerchandiseApplicationFeeCents(lines),
      split.goodsServicesCostCents + split.productionFeeCents + split.platformCutCents,
    );
    assert.equal(
      orderConnectApplicationFeeCents({
        lines,
        tipCents: 100,
        paymentProcessingCents: 70,
      }),
      split.goodsServicesCostCents + split.productionFeeCents + split.platformCutCents + 70,
    );
  });
});

describe("orderConnect split ($25 item + $3 tip)", () => {
  it("transfer equals shop cut + tip when production fee is in application fee", () => {
    const subtotalCents = 2500;
    const tipCents = 300;
    const shippingCents = 0;
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: subtotalCents,
      cogsLineCents: 1682,
      productionFeeLineCents: 418,
    });
    const lines = [
      {
        unitPriceCents: subtotalCents,
        quantity: 1,
        goodsServicesCostCents: split.goodsServicesCostCents,
        productionFeeCents: split.productionFeeCents,
        platformCutCents: split.platformCutCents,
        shopCutCents: split.shopCutCents,
      },
    ];
    const paymentProcessingCents = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    const checkoutTotalCents = subtotalCents + tipCents + shippingCents + paymentProcessingCents;
    const applicationFeeCents = orderConnectApplicationFeeCents({
      lines,
      tipCents,
      paymentProcessingCents,
    });
    const shopTransferCents = orderConnectShopTransferCents({ lines, tipCents });

    assert.equal(shopTransferCents, split.shopCutCents + tipCents);
    assert.equal(checkoutTotalCents - applicationFeeCents, shopTransferCents);
    assert.ok(split.productionFeeCents > 0);
    assert.ok(applicationFeeCents > split.goodsServicesCostCents + split.platformCutCents);
  });

  it("documents pre-fix bug when production fee is omitted from application fee", () => {
    const subtotalCents = 2500;
    const tipCents = 300;
    const shippingCents = 0;
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: subtotalCents,
      cogsLineCents: 1682,
      productionFeeLineCents: 418,
    });
    const lines = [
      {
        goodsServicesCostCents: split.goodsServicesCostCents,
        productionFeeCents: split.productionFeeCents,
        platformCutCents: split.platformCutCents,
        shopCutCents: split.shopCutCents,
      },
    ];
    const paymentProcessingCents = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    const checkoutTotalCents = subtotalCents + tipCents + shippingCents + paymentProcessingCents;
    const correctApplicationFeeCents = orderConnectApplicationFeeCents({
      lines,
      tipCents,
      paymentProcessingCents,
    });
    const buggyApplicationFeeCents =
      split.goodsServicesCostCents + split.platformCutCents + paymentProcessingCents;
    const buggyTransferCents = checkoutTotalCents - buggyApplicationFeeCents;
    const expectedShopTransferCents = split.shopCutCents + tipCents;

    assert.equal(buggyApplicationFeeCents, correctApplicationFeeCents - split.productionFeeCents);
    assert.equal(buggyTransferCents, expectedShopTransferCents + split.productionFeeCents);

    const verification = orderConnectSplitVerification({
      lines,
      tipCents,
      paymentProcessingCents,
      checkoutTotalCents,
      stripeApplicationFeeCents: buggyApplicationFeeCents,
      stripeTransferCents: buggyTransferCents,
    });
    assert.equal(verification.missingProductionFeeInAppFeeCents, split.productionFeeCents);
    assert.equal(verification.transferShortfallCents, split.productionFeeCents);
  });
});

/** 11oz mug reference: $25 sale, COGS $14.18, production fee $3.00 → shop $7.04. */
describe("11oz mug reference split", () => {
  it("matches spreadsheet shop cut and Connect application fee", () => {
    const subtotalCents = 2500;
    const cogsLineCents = 1418;
    const productionFeeLineCents = 300;
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: subtotalCents,
      cogsLineCents,
      productionFeeLineCents,
    });
    assert.equal(split.goodsServicesCostCents, cogsLineCents);
    assert.equal(split.productionFeeCents, productionFeeLineCents);
    assert.equal(split.platformCutCents, 78);
    assert.equal(split.shopCutCents, 704);

    const lines = [
      {
        unitPriceCents: subtotalCents,
        quantity: 1,
        goodsServicesCostCents: split.goodsServicesCostCents,
        productionFeeCents: split.productionFeeCents,
        platformCutCents: split.platformCutCents,
        shopCutCents: split.shopCutCents,
      },
    ];
    assert.equal(orderConnectMerchandiseApplicationFeeCents(lines), 1796);

    const paymentProcessingCents = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents: 0,
      tipCents: 0,
    });
    const checkoutTotalCents = subtotalCents + paymentProcessingCents;
    const applicationFeeCents = orderConnectApplicationFeeCents({
      lines,
      tipCents: 0,
      paymentProcessingCents,
    });
    assert.equal(paymentProcessingCents, 106);
    assert.equal(applicationFeeCents, 1902);
    assert.equal(orderConnectShopTransferCents({ lines, tipCents: 0 }), 704);
    assert.equal(checkoutTotalCents - applicationFeeCents, 704);
  });
});

describe("orderMerchandiseBreakdownTotals", () => {
  it("preserves sale = item cost + platform + shop identity", () => {
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: 1500,
      cogsLineCents: 500,
      productionFeeLineCents: 100,
    });
    const line = {
      unitPriceCents: 1500,
      quantity: 1,
      goodsServicesCostCents: split.goodsServicesCostCents,
      productionFeeCents: split.productionFeeCents,
      platformCutCents: split.platformCutCents,
      shopCutCents: split.shopCutCents,
    };
    const totals = orderMerchandiseBreakdownTotals([line]);
    assert.equal(
      totals.saleCents,
      totals.goodsServicesCostCents +
        totals.productionFeeCents +
        totals.platformCutCents +
        totals.shopCutCents,
    );
    assert.equal(totals.shopCutCents, orderShopProfitCents({ lines: [line], tipCents: 0 }));
  });
});
