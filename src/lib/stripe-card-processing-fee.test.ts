import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buyerCardProcessingFeeCents,
  buyerCheckoutTotalCents,
  buyerPaymentProcessingFeeCents,
  checkoutProcessingFeeFromTotal,
  merchandiseSubtotalFromCheckoutTotalCents,
  stripeBalanceProcessingFeeCents,
  stripeCheckoutPaymentProcessingLineItem,
  PAYMENT_PROCESSING_LABEL,
} from "@/lib/stripe-card-processing-fee";
import { SHOP_SETUP_FEE_CENTS } from "@/lib/creator-gift-codes";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";

describe("stripe card processing fee", () => {
  it("returns zero for non-positive subtotals", () => {
    assert.equal(buyerCardProcessingFeeCents(0), 0);
    assert.equal(buyerCheckoutTotalCents(0), 0);
    assert.equal(buyerPaymentProcessingFeeCents({ subtotalCents: 0 }), 0);
  });

  it("grosses up the fifteen-dollar shop setup fee", () => {
    const fee = buyerCardProcessingFeeCents(SHOP_SETUP_FEE_CENTS);
    assert.equal(buyerCheckoutTotalCents(SHOP_SETUP_FEE_CENTS), SHOP_SETUP_FEE_CENTS + fee);
    assert.equal(fee, 76);
    assert.equal(SHOP_SETUP_FEE_CENTS + fee, 1576);
    assert.equal(
      buyerPaymentProcessingFeeCents({ subtotalCents: SHOP_SETUP_FEE_CENTS }),
      fee,
    );
    assert.equal(merchandiseSubtotalFromCheckoutTotalCents(1576), SHOP_SETUP_FEE_CENTS);
    assert.equal(checkoutProcessingFeeFromTotal(1576, SHOP_SETUP_FEE_CENTS), fee);
  });

  it("includes shipping and tip in cart-style gross-up plus flat surcharge", () => {
    const fee = buyerPaymentProcessingFeeCents({
      subtotalCents: 2000,
      shippingCents: 500,
      tipCents: 100,
    });
    assert.equal(fee, buyerCardProcessingFeeCents(2600) + 25);
  });

  it("adds no flat surcharge when tip is zero", () => {
    const fee = buyerPaymentProcessingFeeCents({
      subtotalCents: 2000,
      shippingCents: 500,
      tipCents: 0,
    });
    assert.equal(fee, buyerCardProcessingFeeCents(2500));
  });

  it("adds tax-service into gross-up base when includeTaxService is true", () => {
    const without = buyerPaymentProcessingFeeCents({
      subtotalCents: 50000,
      shippingCents: 500,
      tipCents: 0,
      includeTaxService: false,
    });
    const withTax = buyerPaymentProcessingFeeCents({
      subtotalCents: 50000,
      shippingCents: 500,
      tipCents: 0,
      includeTaxService: true,
    });
    assert.ok(withTax > without);
  });

  it("builds a Payment Processing checkout line item", () => {
    const line = stripeCheckoutPaymentProcessingLineItem({ subtotalCents: 1000 });
    assert.ok(line);
    assert.equal(line!.price_data.unit_amount, buyerPaymentProcessingFeeCents({ subtotalCents: 1000 }));
    assert.equal(line!.price_data.product_data.name, PAYMENT_PROCESSING_LABEL);
    assert.equal(line!.price_data.product_data.metadata?.kind, "payment_processing");
  });

  it("matches Stripe balance fee on the five-dollar shop flair charge", () => {
    const processing = buyerPaymentProcessingFeeCents({
      subtotalCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
    });
    const chargeCents = SHOP_FLAIR_ACCESS_PRICE_CENTS + processing;
    assert.equal(processing, 46);
    assert.equal(chargeCents, 546);
    assert.equal(stripeBalanceProcessingFeeCents(chargeCents), 46);
    assert.equal(
      stripeBalanceProcessingFeeCents(SHOP_FLAIR_ACCESS_PRICE_CENTS),
      45,
      "naive fee on merchandise alone understates Stripe fee on the full charge",
    );
  });
});
