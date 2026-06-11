import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  CREATOR_GIFT_LISTING_SPLIT_LABEL,
  mergedLineCheckoutPaidCents,
  mergedLinePaidCogsStripeNetCents,
  mergedLineStripeBalanceFeeCents,
} from "@/lib/admin-platform-sales-merged-line-model";
import { buildCreatorGiftPurchaseMergedLines } from "@/lib/admin-platform-sales-merged-lines";
import {
  buyerCheckoutTotalCents,
  stripeBalanceProcessingFeeCents,
} from "@/lib/stripe-card-processing-fee";

describe("creator gift listing + promotion split", () => {
  it("allocates full paid and Stripe fee to promotion row; listing row is profit-only", () => {
    const listingMerchCents = 500;
    const promotionMerchCents = 1500;
    const totalMerchCents = listingMerchCents + promotionMerchCents;
    const fullChargeCents = buyerCheckoutTotalCents(totalMerchCents);
    const fullStripeFeeCents = stripeBalanceProcessingFeeCents(fullChargeCents);

    const lines = buildCreatorGiftPurchaseMergedLines({
      id: "gift-split-1",
      amountCents: fullChargeCents,
      paidAt: new Date("2026-06-05T12:00:00.000Z"),
      transactionNumber: 9001,
      purchaserEmail: "buyer@example.com",
      setupFeeIncluded: false,
      isBetaTesterBatch: false,
      isWaivedShopFeeBatch: false,
      stripeCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_test",
      recipientShop: null,
      listingCreditPackId: "pack_5",
      listingCreditsGranted: 5,
      googleShoppingCreditPackId: null,
      googleShoppingCreditsGranted: 0,
      promotionKind: PromotionKind.HOT_FEATURED_ITEM,
      promotionCreditsGranted: 1,
      shopFlairIncluded: false,
    });

    assert.strictEqual(lines.length, 2);

    const listingLine = lines.find((l) => l.platformSaleCategory === "listing");
    const promotionLine = lines.find((l) => l.platformSaleCategory === "promotion");
    assert.ok(listingLine);
    assert.ok(promotionLine);

    assert.strictEqual(listingLine.productName, CREATOR_GIFT_LISTING_SPLIT_LABEL);
    assert.strictEqual(mergedLineCheckoutPaidCents(listingLine), 0);
    assert.strictEqual(mergedLineStripeBalanceFeeCents(listingLine), 0);
    assert.strictEqual(mergedLinePaidCogsStripeNetCents(listingLine), listingMerchCents);

    assert.strictEqual(mergedLineCheckoutPaidCents(promotionLine), fullChargeCents);
    assert.strictEqual(mergedLineStripeBalanceFeeCents(promotionLine), fullStripeFeeCents);
    assert.strictEqual(mergedLinePaidCogsStripeNetCents(promotionLine), promotionMerchCents);

    const summedStripeFees = lines.reduce(
      (sum, l) => sum + mergedLineStripeBalanceFeeCents(l),
      0,
    );
    assert.strictEqual(summedStripeFees, fullStripeFeeCents);
    assert.notStrictEqual(summedStripeFees, fullStripeFeeCents * 2);

    const combinedProfit = lines.reduce(
      (sum, l) => sum + mergedLinePaidCogsStripeNetCents(l),
      0,
    );
    assert.strictEqual(combinedProfit, fullChargeCents - fullStripeFeeCents);
    assert.strictEqual(combinedProfit, totalMerchCents);

    assert.strictEqual(listingLine.quantity, 1);
    assert.strictEqual(promotionLine.quantity, 1);
  });

  it("counts promotion credits and listing pack separately on split rows", () => {
    const totalMerchCents = 500 + 1500 * 2;
    const fullChargeCents = buyerCheckoutTotalCents(totalMerchCents);

    const lines = buildCreatorGiftPurchaseMergedLines({
      id: "gift-split-qty",
      amountCents: fullChargeCents,
      paidAt: new Date("2026-06-05T12:00:00.000Z"),
      transactionNumber: 9003,
      purchaserEmail: "buyer@example.com",
      setupFeeIncluded: false,
      isBetaTesterBatch: false,
      isWaivedShopFeeBatch: false,
      stripeCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_test",
      recipientShop: null,
      listingCreditPackId: "pack_5",
      listingCreditsGranted: 5,
      googleShoppingCreditPackId: null,
      googleShoppingCreditsGranted: 0,
      promotionKind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
      promotionCreditsGranted: 2,
      shopFlairIncluded: false,
    });

    const listingLine = lines.find((l) => l.platformSaleCategory === "listing");
    const promotionLine = lines.find((l) => l.platformSaleCategory === "promotion");
    assert.ok(listingLine);
    assert.ok(promotionLine);
    assert.strictEqual(listingLine.quantity, 1);
    assert.strictEqual(promotionLine.quantity, 2);
    assert.strictEqual(
      lines.reduce((sum, l) => sum + l.quantity, 0),
      3,
    );
  });

  it("counts multiple promotion kinds on one promotion row", () => {
    const totalMerchCents = 1500 * 2 + 500;
    const fullChargeCents = buyerCheckoutTotalCents(totalMerchCents);

    const lines = buildCreatorGiftPurchaseMergedLines({
      id: "gift-multi-promo",
      amountCents: fullChargeCents,
      paidAt: new Date("2026-06-05T12:00:00.000Z"),
      transactionNumber: 9010,
      purchaserEmail: "buyer@example.com",
      setupFeeIncluded: false,
      isBetaTesterBatch: false,
      isWaivedShopFeeBatch: false,
      stripeCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_test",
      recipientShop: null,
      listingCreditPackId: null,
      listingCreditsGranted: 0,
      googleShoppingCreditPackId: null,
      googleShoppingCreditsGranted: 0,
      promotionKind: null,
      promotionCreditsGranted: 0,
      promotionGrants: [
        { kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 },
        { kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM, credits: 1 },
      ],
      shopFlairIncluded: false,
    });

    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0]!.quantity, 3);
    assert.strictEqual(lines[0]!.productName, "Gift - Multiple Promo Credits");
  });

  it("uses Gift - Multiple Promo Credits label when multiple promotion parts are gifted", () => {
    const totalMerchCents = 500 + 1500 + 5000;
    const fullChargeCents = buyerCheckoutTotalCents(totalMerchCents);

    const lines = buildCreatorGiftPurchaseMergedLines({
      id: "gift-split-2",
      amountCents: fullChargeCents,
      paidAt: new Date("2026-06-05T12:00:00.000Z"),
      transactionNumber: 9002,
      purchaserEmail: "buyer@example.com",
      setupFeeIncluded: false,
      isBetaTesterBatch: false,
      isWaivedShopFeeBatch: false,
      stripeCheckoutSessionId: "cs_test",
      stripePaymentIntentId: "pi_test",
      recipientShop: null,
      listingCreditPackId: "pack_5",
      listingCreditsGranted: 5,
      googleShoppingCreditPackId: null,
      googleShoppingCreditsGranted: 0,
      promotionKind: PromotionKind.HOT_FEATURED_ITEM,
      promotionCreditsGranted: 1,
      shopFlairIncluded: true,
    });

    const promotionLine = lines.find((l) => l.platformSaleCategory === "promotion");
    assert.ok(promotionLine);
    assert.strictEqual(promotionLine.productName, "Gift - Multiple Promo Credits");
  });
});
