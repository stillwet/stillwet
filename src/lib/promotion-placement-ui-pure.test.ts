import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlacementPeriodChoices } from "@/lib/promotion-placement-ui-pure";
import { TOP_SHOP_PLATFORM_PERIOD_CAP } from "@/lib/promotion-policy-shared";
import {
  getPromotionPeriodIndexContaining,
  promotionPeriodStartUtc,
} from "@/lib/promotion-period-pacific";

describe("buildPlacementPeriodChoices", () => {
  it("allows Following when that period has capacity (not only when Upcoming is full)", () => {
    const now = new Date("2026-05-15T12:00:00.000Z");
    const currentIdx = getPromotionPeriodIndexContaining(now);
    const periodStarts = [0, 1, 2].map((o) => promotionPeriodStartUtc(currentIdx + o)) as [
      Date,
      Date,
      Date,
    ];
    const zeroFilled: [number, number, number] = [0, 0, 0];

    const choices = buildPlacementPeriodChoices(
      5000,
      TOP_SHOP_PLATFORM_PERIOD_CAP,
      zeroFilled,
      periodStarts,
      currentIdx,
      now,
    );

    const following = choices.find((c) => c.offset === 2);
    assert.equal(following?.selectable, true);
    assert.equal(following?.disabledReason, null);
  });
});
