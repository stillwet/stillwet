import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  buildCreatorGiftRollupItems,
  formatCreatorGiftRollupNoticeBody,
} from "@/lib/creator-gift-notices";

describe("creator gift rollup notices", () => {
  it("combines multiple upgrade types into one message", () => {
    const body = formatCreatorGiftRollupNoticeBody({
      giftFromName: "Alex",
      items: buildCreatorGiftRollupItems({
        listingCreditsGranted: 5,
        promotionKind: PromotionKind.HOT_FEATURED_ITEM,
        promotionCreditsGranted: 3,
        googleShoppingCreditsGranted: 0,
        shopFlairIncluded: false,
      }),
    });
    assert.equal(body, "Alex gifted you 5 listing credits and 3 Hot item credits!");
  });

  it("lists each promotion kind separately", () => {
    const body = formatCreatorGiftRollupNoticeBody({
      giftFromName: "Alex",
      items: buildCreatorGiftRollupItems({
        listingCreditsGranted: 0,
        promotionGrants: [
          { kind: PromotionKind.HOT_FEATURED_ITEM, credits: 2 },
          { kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM, credits: 1 },
        ],
        googleShoppingCreditsGranted: 0,
        shopFlairIncluded: false,
      }),
    });
    assert.equal(
      body,
      "Alex gifted you 2 Hot item credits and Popular item credit!",
    );
  });

  it("supports anonymous gifters", () => {
    const body = formatCreatorGiftRollupNoticeBody({
      giftFromName: null,
      items: [{ quantity: 2, giftLabel: "listing credit" }],
    });
    assert.equal(body, "An anonymous gifter has sent you 2 listing credits!");
  });
});
