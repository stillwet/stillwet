import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  PLATFORM_ORDER_NUMBER_FIRST,
  PLATFORM_TRANSACTION_PRODUCT,
  formatMultipleGiftsTransactionReference,
  formatPlatformTransactionReference,
  platformTransactionDisplayName,
  promotionKindToPlatformTransactionProduct,
  stripePlatformTransactionReferenceFields,
} from "@/lib/platform-transaction-reference";

describe("PLATFORM_ORDER_NUMBER_FIRST", () => {
  it("starts the shared sequence at 1253", () => {
    assert.equal(PLATFORM_ORDER_NUMBER_FIRST, 1253);
  });
});

describe("formatMultipleGiftsTransactionReference", () => {
  it("labels multi-category creator gifts", () => {
    assert.equal(formatMultipleGiftsTransactionReference(1253), "Multiple Gifts - #1253");
  });
});

describe("formatPlatformTransactionReference", () => {
  it("formats product label with number", () => {
    assert.equal(
      formatPlatformTransactionReference(PLATFORM_TRANSACTION_PRODUCT.shop_creation_fee, 1),
      "Shop Creation Fee - #1",
    );
  });

  it("appends gift suffix when requested", () => {
    assert.equal(
      formatPlatformTransactionReference(PLATFORM_TRANSACTION_PRODUCT.listing_credits, 3, {
        gift: true,
      }),
      "Listing Credits - #3 (Gift)",
    );
  });
});

describe("promotionKindToPlatformTransactionProduct", () => {
  it("maps promotion kinds to product keys", () => {
    assert.equal(
      promotionKindToPlatformTransactionProduct(PromotionKind.FEATURED_SHOP_HOME),
      PLATFORM_TRANSACTION_PRODUCT.featured_shop_promo,
    );
    assert.equal(
      promotionKindToPlatformTransactionProduct(PromotionKind.HOT_FEATURED_ITEM),
      PLATFORM_TRANSACTION_PRODUCT.hot_item_promo,
    );
    assert.equal(
      promotionKindToPlatformTransactionProduct(PromotionKind.MOST_POPULAR_OF_TAG_ITEM),
      PLATFORM_TRANSACTION_PRODUCT.popular_item_promo,
    );
  });
});

describe("stripePlatformTransactionReferenceFields", () => {
  it("returns matching description, line item name, and metadata", () => {
    const fields = stripePlatformTransactionReferenceFields(
      PLATFORM_TRANSACTION_PRODUCT.support_platform,
      12,
    );
    assert.equal(fields.description, "Support Platform - #12");
    assert.equal(fields.lineItemName, "Support Platform - #12");
    assert.equal(fields.metadata.platformTransactionProduct, "support_platform");
    assert.equal(fields.metadata.platformTransactionNumber, "12");
    assert.equal(fields.metadata.platformTransactionGift, undefined);
  });
});

describe("platformTransactionDisplayName", () => {
  it("covers all registered products", () => {
    for (const key of Object.values(PLATFORM_TRANSACTION_PRODUCT)) {
      assert.ok(platformTransactionDisplayName(key).length > 0);
    }
  });
});
