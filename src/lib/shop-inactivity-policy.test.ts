import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  daysAgo,
  SHOP_INACTIVITY_DEACTIVATE_DAYS,
  SHOP_INACTIVITY_REACTIVATION_WINDOW_DAYS,
  SHOP_INACTIVITY_WARNING_DAYS,
  shopInactivityReactivationWindowExpired,
  shopIsInactivityDeactivated,
  splitMerchandiseLineForInactiveShopCents,
} from "@/lib/shop-inactivity-policy";

describe("shop inactivity policy", () => {
  it("uses 30/60 day warning and deactivation windows", () => {
    assert.equal(SHOP_INACTIVITY_WARNING_DAYS, 30);
    assert.equal(SHOP_INACTIVITY_DEACTIVATE_DAYS, 60);
    assert.equal(SHOP_INACTIVITY_REACTIVATION_WINDOW_DAYS, 30);
  });

  it("treats any inactivity deactivation timestamp as deactivated", () => {
    assert.equal(shopIsInactivityDeactivated({ inactivityDeactivatedAt: null }), false);
    assert.equal(shopIsInactivityDeactivated({ inactivityDeactivatedAt: new Date("2026-01-01") }), true);
  });

  it("routes all merchandise profit to the platform for inactive shops", () => {
    assert.deepEqual(
      splitMerchandiseLineForInactiveShopCents({
        lineMerchandiseCents: 2500,
        cogsLineCents: 900,
        productionFeeLineCents: 0,
      }),
      {
        goodsServicesCostCents: 900,
        productionFeeCents: 0,
        platformCutCents: 1600,
        shopCutCents: 0,
      },
    );
  });

  it("caps goods and services at the merchandise line before platform routing", () => {
    assert.deepEqual(
      splitMerchandiseLineForInactiveShopCents({
        lineMerchandiseCents: 1000,
        cogsLineCents: 2000,
        productionFeeLineCents: 0,
      }),
      {
        goodsServicesCostCents: 1000,
        productionFeeCents: 0,
        platformCutCents: 0,
        shopCutCents: 0,
      },
    );
  });

  it("computes day cutoffs in whole UTC milliseconds", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    assert.equal(daysAgo(30, now).toISOString(), "2026-04-25T12:00:00.000Z");
  });

  it("detects expired reactivation windows", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    const deactivatedAt = new Date("2026-04-24T11:59:59.000Z");
    assert.equal(shopInactivityReactivationWindowExpired(deactivatedAt, now), true);
    assert.equal(
      shopInactivityReactivationWindowExpired(new Date("2026-04-26T12:00:00.000Z"), now),
      false,
    );
  });
});
