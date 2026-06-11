import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergedLineCheckoutPaidCents,
  mergedLinePaidCogsStripeNetCents,
  mergedLineStripeBalanceFeeCents,
} from "@/lib/admin-platform-sales-merged-line-model";
import {
  buyerCheckoutTotalCents,
  buyerPaymentProcessingFeeCents,
  stripeBalanceProcessingFeeCents,
} from "@/lib/stripe-card-processing-fee";
import {
  supportTipMerchandiseCents,
  supportTipMerchandiseCentsFromCheckoutSession,
} from "@/lib/support-site";

const FIVE_DOLLAR_TIP_CENTS = 500;

function supportTipMergedLine(amountCents: number) {
  const merchandiseCents = supportTipMerchandiseCents({ amountCents });
  const checkoutTotalCents = buyerCheckoutTotalCents(merchandiseCents);
  return {
    kind: "support_tip" as const,
    platformSaleCategory: "support" as const,
    id: "support_tip:test",
    quantity: 1,
    unitPriceCents: checkoutTotalCents,
    productName: "Support <3",
    checkoutTotalCents,
    itemPriceCents: merchandiseCents,
    tipCents: 0,
    goodsServicesCostCents: 0,
    productionFeeCents: 0,
    platformCutCents: merchandiseCents,
    shopCutCents: 0,
    stripeFeeCents: stripeBalanceProcessingFeeCents(checkoutTotalCents),
    tipProcessingFeeCents: 0,
    order: { id: "support_tip:test", createdAt: new Date(), orderNumber: 1 },
    shop: null,
    transactionEmail: null,
    itemHref: null,
  };
}

describe("supportTipMerchandiseCents", () => {
  it("returns stored amount when it is already merchandise", () => {
    assert.equal(supportTipMerchandiseCents({ amountCents: FIVE_DOLLAR_TIP_CENTS }), 500);
  });

  it("inverts legacy rows that stored the full card charge", () => {
    const chargeCents = buyerCheckoutTotalCents(FIVE_DOLLAR_TIP_CENTS);
    assert.equal(chargeCents, 546);
    assert.equal(supportTipMerchandiseCents({ amountCents: chargeCents }), 500);
  });
});

describe("supportTipMerchandiseCentsFromCheckoutSession", () => {
  it("prefers metadata subtotal over amount_total", () => {
    assert.equal(
      supportTipMerchandiseCentsFromCheckoutSession({
        amount_total: 546,
        metadata: { subtotalCents: "500", paymentProcessingCents: "46" },
      }),
      500,
    );
  });

  it("falls back to inverting amount_total when metadata is missing", () => {
    assert.equal(
      supportTipMerchandiseCentsFromCheckoutSession({ amount_total: 546, metadata: {} }),
      500,
    );
  });
});

describe("support tip admin platform sales breakdown", () => {
  it("shows $5.46 paid, $0.46 stripe fee, $5.00 profit for a correct $5 tip row", () => {
    const line = supportTipMergedLine(FIVE_DOLLAR_TIP_CENTS);
    const processing = buyerPaymentProcessingFeeCents({ subtotalCents: FIVE_DOLLAR_TIP_CENTS });

    assert.equal(processing, 46);
    assert.equal(mergedLineCheckoutPaidCents(line), 546);
    assert.equal(mergedLineStripeBalanceFeeCents(line), 46);
    assert.equal(mergedLinePaidCogsStripeNetCents(line), 500);
  });

  it("normalizes legacy corrupted rows the same way", () => {
    const chargeCents = buyerCheckoutTotalCents(FIVE_DOLLAR_TIP_CENTS);
    const correctLine = supportTipMergedLine(FIVE_DOLLAR_TIP_CENTS);
    const legacyLine = supportTipMergedLine(chargeCents);

    assert.equal(mergedLineCheckoutPaidCents(legacyLine), mergedLineCheckoutPaidCents(correctLine));
    assert.equal(
      mergedLineStripeBalanceFeeCents(legacyLine),
      mergedLineStripeBalanceFeeCents(correctLine),
    );
    assert.equal(
      mergedLinePaidCogsStripeNetCents(legacyLine),
      mergedLinePaidCogsStripeNetCents(correctLine),
    );
    assert.equal(mergedLinePaidCogsStripeNetCents(legacyLine), 500);
  });
});
