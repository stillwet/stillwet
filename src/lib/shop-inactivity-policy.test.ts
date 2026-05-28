import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysAgo,
  shopIsInactivityDeactivated,
  splitMerchandiseLineForInactiveShopCents,
} from "@/lib/shop-inactivity-policy";

describe("shop inactivity policy", () => {
  it("treats any inactivity deactivation timestamp as deactivated", () => {
    assert.equal(shopIsInactivityDeactivated({ inactivityDeactivatedAt: null }), false);
    assert.equal(shopIsInactivityDeactivated({ inactivityDeactivatedAt: new Date("2026-01-01") }), true);
  });

  it("routes all merchandise profit to the platform for inactive shops", () => {
    assert.deepEqual(
      splitMerchandiseLineForInactiveShopCents({
        lineMerchandiseCents: 2500,
        goodsServicesLineCents: 900,
      }),
      {
        goodsServicesCostCents: 900,
        platformCutCents: 1600,
        shopCutCents: 0,
      },
    );
  });

  it("caps goods and services at the merchandise line before platform routing", () => {
    assert.deepEqual(
      splitMerchandiseLineForInactiveShopCents({
        lineMerchandiseCents: 1000,
        goodsServicesLineCents: 2000,
      }),
      {
        goodsServicesCostCents: 1000,
        platformCutCents: 0,
        shopCutCents: 0,
      },
    );
  });

  it("computes day cutoffs in whole UTC milliseconds", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    assert.equal(daysAgo(60, now).toISOString(), "2026-03-26T12:00:00.000Z");
  });
});
