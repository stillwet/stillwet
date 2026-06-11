import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  legacyPromotionFieldsFromGrants,
  parsePromotionGrantsFromFormData,
  promotionGrantFormFieldName,
  promotionGrantsFromPurchase,
  promotionGrantsMerchandiseCents,
  validatePromotionGrants,
} from "@/lib/creator-gift-promotion-grants";

describe("creator gift promotion grants", () => {
  it("parses per-kind quantities from form data", () => {
    const fd = new FormData();
    fd.set(promotionGrantFormFieldName(PromotionKind.HOT_FEATURED_ITEM), "2");
    fd.set(promotionGrantFormFieldName(PromotionKind.MOST_POPULAR_OF_TAG_ITEM), "1");
    fd.set(promotionGrantFormFieldName(PromotionKind.FEATURED_SHOP_HOME), "0");

    const grants = parsePromotionGrantsFromFormData(fd);
    assert.deepEqual(grants, [
      { kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 },
      { kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM, credits: 1 },
    ]);
  });

  it("validates per-kind caps and requires a positive quantity when enabled", () => {
    assert.equal(
      validatePromotionGrants([], true),
      "Choose at least one upgrade credit quantity greater than zero.",
    );
    assert.equal(
      validatePromotionGrants([{ kind: PromotionKind.HOT_FEATURED_ITEM, credits: 11 }], true),
      "Enter promotion credits between 1 and 10 for each upgrade type.",
    );
    assert.equal(
      validatePromotionGrants([{ kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 }], true),
      null,
    );
  });

  it("sums merchandise across multiple kinds", () => {
    const grants = [
      { kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 },
      { kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM, credits: 1 },
    ];
    assert.equal(promotionGrantsMerchandiseCents(grants), 1500 * 2 + 500);
  });

  it("falls back to legacy purchase columns when grant rows are absent", () => {
    assert.deepEqual(
      promotionGrantsFromPurchase({
        promotionKind: PromotionKind.HOT_FEATURED_ITEM,
        promotionCreditsGranted: 3,
      }),
      [{ kind: PromotionKind.HOT_FEATURED_ITEM, credits: 3 }],
    );
  });

  it("mirrors legacy columns only for a single grant", () => {
    assert.deepEqual(
      legacyPromotionFieldsFromGrants([
        { kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 },
      ]),
      {
        promotionKind: PromotionKind.HOT_FEATURED_ITEM,
        promotionCreditsGranted: 2,
      },
    );
    assert.deepEqual(
      legacyPromotionFieldsFromGrants([
        { kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 },
        { kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM, credits: 1 },
      ]),
      { promotionKind: null, promotionCreditsGranted: 0 },
    );
  });
});
