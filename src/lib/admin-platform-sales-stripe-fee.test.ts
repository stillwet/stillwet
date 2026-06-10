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
  mergedLineCheckoutPaidCents,
  mergedLineStripeBalanceFeeCents,
  platformCheckoutFullChargeCents,
} from "@/lib/admin-platform-sales-merged-line-model";
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
      stripeFeeCents: processing,
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
