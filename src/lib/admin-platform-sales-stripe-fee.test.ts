import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLATFORM_TIP_FEE_CENTS } from "@/lib/checkout-tip";
import {
  allocateMerchandiseLineStripeBalanceFeeCents,
  allocateMerchandiseOrderLineShareCents,
  merchandiseOrderPaymentProcessingCents,
  merchandiseOrderStripeBalanceFeeCents,
  merchandiseOrderStripePassThroughCents,
  merchandiseOrderTipProcessingFeeCents,
} from "@/lib/admin-platform-sales-merged-lines";
import {
  mergedLineApplicationAmountCents,
  mergedLineBuyerPaymentProcessingPassThroughCents,
  mergedLineCheckoutPaidCents,
  mergedLineShopPayoutCents,
  mergedLineStripeBalanceFeeCents,
  platformCheckoutFullChargeCents,
} from "@/lib/admin-platform-sales-merged-line-model";
import { splitMerchandiseLineWithItemCostCents } from "@/lib/item-cost-cents";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";
import { shopFlairPurchaseMerchandiseCents } from "@/lib/admin-platform-shop-upgrades-revenue";
import {
  buyerPaymentProcessingFeeCents,
  stripeBalanceProcessingFeeCents,
} from "@/lib/stripe-card-processing-fee";

describe("merchandise order stripe fee pass-through", () => {
  it("splits payment processing into stripe pass-through and tip surcharge", () => {
    const subtotalCents = 2000;
    const shippingCents = 500;
    const tipCents = 100;
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    assert.ok(processing > PLATFORM_TIP_FEE_CENTS);

    const order = {
      subtotalCents,
      tipCents,
      shippingCents,
      totalCents: subtotalCents + tipCents + shippingCents + processing,
    };

    assert.equal(merchandiseOrderPaymentProcessingCents(order), processing);
    assert.equal(
      merchandiseOrderStripePassThroughCents(order),
      processing - PLATFORM_TIP_FEE_CENTS,
    );
    assert.equal(merchandiseOrderTipProcessingFeeCents(order), PLATFORM_TIP_FEE_CENTS);
    assert.equal(
      merchandiseOrderStripePassThroughCents(order) + merchandiseOrderTipProcessingFeeCents(order),
      merchandiseOrderPaymentProcessingCents(order),
    );
  });

  it("stripe pass-through is 25¢ below full processing on tipped orders", () => {
    const processing = 146;
    const order = {
      subtotalCents: 3000,
      tipCents: 100,
      shippingCents: 500,
      totalCents: 3000 + 100 + 500 + processing,
    };
    assert.equal(merchandiseOrderPaymentProcessingCents(order), processing);
    assert.equal(merchandiseOrderStripePassThroughCents(order), 121);
  });

  it("matches full processing when there is no cart tip", () => {
    const subtotalCents = 2000;
    const shippingCents = 500;
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents: 0,
    });
    const order = {
      subtotalCents,
      tipCents: 0,
      shippingCents,
      totalCents: subtotalCents + shippingCents + processing,
    };

    assert.equal(merchandiseOrderPaymentProcessingCents(order), processing);
    assert.equal(merchandiseOrderStripePassThroughCents(order), processing);
    assert.equal(merchandiseOrderTipProcessingFeeCents(order), 0);
  });
});

describe("merchandise order admin line breakdown", () => {
  it("allocates checkout total, tip, and stripe balance fee across lines", () => {
    const subtotalCents = 3000;
    const tipCents = 100;
    const shippingCents = 500;
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    const order = {
      subtotalCents,
      tipCents,
      shippingCents,
      totalCents: subtotalCents + tipCents + shippingCents + processing,
    };
    const lineMerch = 1500;

    assert.equal(
      allocateMerchandiseOrderLineShareCents(order, lineMerch, order.totalCents),
      Math.round(order.totalCents / 2),
    );
    assert.equal(allocateMerchandiseOrderLineShareCents(order, lineMerch, tipCents), 50);
    assert.equal(
      allocateMerchandiseLineStripeBalanceFeeCents(order, lineMerch),
      Math.round(stripeBalanceProcessingFeeCents(order.totalCents) / 2),
    );
  });

  it("application amount is COGS + production fee + platform cut + stripe pass-through", () => {
    const subtotalCents = 2500;
    const tipCents = 100;
    const shippingCents = 500;
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    const order = {
      subtotalCents,
      tipCents,
      shippingCents,
      totalCents: subtotalCents + tipCents + shippingCents + processing,
    };
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: subtotalCents,
      cogsLineCents: 900,
      productionFeeLineCents: 115,
    });
    const line = {
      kind: "merchandise" as const,
      platformSaleCategory: "item" as const,
      id: "line-1",
      quantity: 1,
      unitPriceCents: subtotalCents,
      productName: "Test",
      checkoutTotalCents: order.totalCents,
      itemPriceCents: subtotalCents,
      tipCents,
      goodsServicesCostCents: split.goodsServicesCostCents,
      productionFeeCents: split.productionFeeCents,
      platformCutCents: split.platformCutCents,
      shopCutCents: split.shopCutCents,
      stripeFeeCents: merchandiseOrderStripeBalanceFeeCents(order),
      tipProcessingFeeCents: PLATFORM_TIP_FEE_CENTS,
      order: {
        id: "order-1",
        createdAt: new Date(),
        orderNumber: 1257,
        stripePaymentIntentId: null,
      },
      shop: null,
      buyer: { email: null, shippingState: null, shippingCountry: null },
      itemHref: null,
    };

    const applicationAmount = mergedLineApplicationAmountCents(line);
    const linePassThrough = mergedLineBuyerPaymentProcessingPassThroughCents(line);
    const merchandiseApplication =
      split.goodsServicesCostCents + split.productionFeeCents + split.platformCutCents;

    assert.equal(mergedLineShopPayoutCents(line), split.shopCutCents + tipCents);
    assert.equal(applicationAmount, merchandiseApplication + linePassThrough);
    assert.ok(linePassThrough > 0);
    assert.ok(mergedLineStripeBalanceFeeCents(line) > 0);
  });

  it("buyer payment processing pass-through is nested under application amount", () => {
    const subtotalCents = 2500;
    const tipCents = 0;
    const shippingCents = 0;
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: subtotalCents,
      cogsLineCents: 1418,
      productionFeeLineCents: 300,
    });
    const line = {
      kind: "merchandise" as const,
      platformSaleCategory: "item" as const,
      id: "line-mug",
      quantity: 1,
      unitPriceCents: subtotalCents,
      productName: "11oz mug",
      checkoutTotalCents: subtotalCents + processing,
      itemPriceCents: subtotalCents,
      tipCents: 0,
      goodsServicesCostCents: split.goodsServicesCostCents,
      productionFeeCents: split.productionFeeCents,
      platformCutCents: split.platformCutCents,
      shopCutCents: split.shopCutCents,
      stripeFeeCents: merchandiseOrderStripeBalanceFeeCents({
        subtotalCents,
        tipCents,
        shippingCents,
        totalCents: subtotalCents + processing,
      }),
      tipProcessingFeeCents: 0,
      order: { id: "order-mug", createdAt: new Date(), orderNumber: 1274, stripePaymentIntentId: null },
      shop: null,
      buyer: { email: null, shippingState: null, shippingCountry: null },
      itemHref: null,
    };

    assert.equal(split.shopCutCents, 704);
    assert.equal(mergedLineShopPayoutCents(line), 704);
    assert.equal(mergedLineBuyerPaymentProcessingPassThroughCents(line), processing);
    assert.equal(
      mergedLineApplicationAmountCents(line),
      split.goodsServicesCostCents +
        split.productionFeeCents +
        split.platformCutCents +
        processing,
    );
    assert.equal(mergedLineApplicationAmountCents(line), 1902);
  });

  it("$25 mug with COGS 1192 and prod 575 shows $19.46 application amount", () => {
    const subtotalCents = 2500;
    const split = splitMerchandiseLineWithItemCostCents({
      lineMerchandiseCents: subtotalCents,
      cogsLineCents: 1192,
      productionFeeLineCents: 575,
    });
    const line = {
      kind: "merchandise" as const,
      platformSaleCategory: "item" as const,
      id: "line-1276",
      quantity: 1,
      unitPriceCents: subtotalCents,
      productName: "Pathetic Mug",
      checkoutTotalCents: 2606,
      itemPriceCents: subtotalCents,
      tipCents: 0,
      goodsServicesCostCents: split.goodsServicesCostCents,
      productionFeeCents: split.productionFeeCents,
      platformCutCents: split.platformCutCents,
      shopCutCents: split.shopCutCents,
      stripeFeeCents: 0,
      tipProcessingFeeCents: 0,
      order: { id: "order-1276", createdAt: new Date(), orderNumber: 1276, stripePaymentIntentId: null },
      shop: null,
      buyer: { email: null, shippingState: null, shippingCountry: null },
      itemHref: null,
    };

    assert.equal(split.shopCutCents, 660);
    assert.equal(mergedLineBuyerPaymentProcessingPassThroughCents(line), 106);
    assert.equal(mergedLineApplicationAmountCents(line), 1946);
  });

  it("stripe balance fee uses full checkout total, not buyer pass-through gross-up", () => {
    const subtotalCents = 3000;
    const tipCents = 100;
    const shippingCents = 500;
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents,
      shippingCents,
      tipCents,
    });
    const order = {
      subtotalCents,
      tipCents,
      shippingCents,
      totalCents: subtotalCents + tipCents + shippingCents + processing,
    };

    assert.equal(merchandiseOrderStripeBalanceFeeCents(order), stripeBalanceProcessingFeeCents(order.totalCents));
  });
});

describe("platform checkout stripe balance fee", () => {
  it("uses balance fee on full card charge for shop flair, not merch-only naive fee", () => {
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
    });
    const chargeCents = SHOP_FLAIR_ACCESS_PRICE_CENTS + processing;

    assert.equal(
      platformCheckoutFullChargeCents({
        checkoutTotalCents: chargeCents,
        itemPriceCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      }),
      chargeCents,
    );
    assert.equal(
      platformCheckoutFullChargeCents({
        checkoutTotalCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
        itemPriceCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      }),
      chargeCents,
    );

    const line = {
      kind: "shop_flair_purchase" as const,
      platformSaleCategory: "promotion" as const,
      id: "shop_flair_purchase:test",
      quantity: 1,
      unitPriceCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      productName: "Shop Flair",
      checkoutTotalCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      itemPriceCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      tipCents: 0,
      goodsServicesCostCents: 0,
      productionFeeCents: 0,
      platformCutCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      shopCutCents: 0,
      stripeFeeCents: stripeBalanceProcessingFeeCents(chargeCents),
      tipProcessingFeeCents: 0,
      order: { id: "shop_flair_purchase:test", createdAt: new Date(), orderNumber: 1 },
      shop: null,
      transactionEmail: null,
      itemHref: null,
    };

    assert.equal(
      mergedLineStripeBalanceFeeCents(line),
      stripeBalanceProcessingFeeCents(chargeCents),
    );
    assert.equal(mergedLineCheckoutPaidCents(line), chargeCents);
    assert.equal(
      mergedLineCheckoutPaidCents(line),
      SHOP_FLAIR_ACCESS_PRICE_CENTS + mergedLineStripeBalanceFeeCents(line),
    );

    line.checkoutTotalCents = chargeCents;
    line.unitPriceCents = chargeCents;
    assert.equal(mergedLineCheckoutPaidCents(line), chargeCents);
    assert.notEqual(
      mergedLineStripeBalanceFeeCents(line),
      stripeBalanceProcessingFeeCents(SHOP_FLAIR_ACCESS_PRICE_CENTS),
    );
  });

  it("treats merch-only shop flair amount as five dollars service, not inverted subtotal", () => {
    assert.equal(shopFlairPurchaseMerchandiseCents({ amountCents: 500 }), 500);

    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
    });
    const chargeCents = SHOP_FLAIR_ACCESS_PRICE_CENTS + processing;

    const mockLine = {
      kind: "shop_flair_purchase" as const,
      platformSaleCategory: "promotion" as const,
      id: "shop_flair_purchase:mock",
      quantity: 1,
      unitPriceCents: chargeCents,
      productName: "Shop Flair",
      checkoutTotalCents: chargeCents,
      itemPriceCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      tipCents: 0,
      goodsServicesCostCents: 0,
      productionFeeCents: 0,
      platformCutCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      shopCutCents: 0,
      stripeFeeCents: stripeBalanceProcessingFeeCents(chargeCents),
      tipProcessingFeeCents: 0,
      order: { id: "shop_flair_purchase:mock", createdAt: new Date(), orderNumber: 1 },
      shop: null,
      transactionEmail: null,
      itemHref: null,
    };

    const legacyLine = {
      ...mockLine,
      checkoutTotalCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      unitPriceCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
    };

    assert.equal(mergedLineCheckoutPaidCents(legacyLine), chargeCents);
    assert.equal(mergedLineCheckoutPaidCents(mockLine), chargeCents);
  });
});
