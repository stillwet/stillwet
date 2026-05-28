import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  buildSharedPlacementPeriodCalendarChoices,
  mergeSharedCalendarWithKindPricing,
} from "@/lib/promotion-placement-ui-pure";

describe("shared placement period calendar", () => {
  it("uses the same date windows for every promotion kind", () => {
    const now = new Date("2026-05-15T12:00:00.000Z");
    const calendar = buildSharedPlacementPeriodCalendarChoices(now);

    const popular = mergeSharedCalendarWithKindPricing(
      calendar,
      PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
      undefined,
      now,
    );
    const hot = mergeSharedCalendarWithKindPricing(
      calendar,
      PromotionKind.HOT_FEATURED_ITEM,
      undefined,
      now,
    );
    const shop = mergeSharedCalendarWithKindPricing(
      calendar,
      PromotionKind.FEATURED_SHOP_HOME,
      undefined,
      now,
    );

    for (const offset of [0, 1, 2] as const) {
      assert.equal(
        popular.find((c) => c.offset === offset)?.placementMonthLabel,
        hot.find((c) => c.offset === offset)?.placementMonthLabel,
      );
      assert.equal(
        popular.find((c) => c.offset === offset)?.placementMonthLabel,
        shop.find((c) => c.offset === offset)?.placementMonthLabel,
      );
      assert.equal(
        popular.find((c) => c.offset === offset)?.eligibleFromIso,
        hot.find((c) => c.offset === offset)?.eligibleFromIso,
      );
    }

    assert.notEqual(
      popular.find((c) => c.offset === 1)?.amountCents,
      shop.find((c) => c.offset === 1)?.amountCents,
    );
  });
});
