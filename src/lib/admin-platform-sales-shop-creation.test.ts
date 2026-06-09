import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ShopSetupFeePurchaseStatus,
  CreatorGiftPurchaseStatus,
  ShopReactivationPurchaseStatus,
} from "@/generated/prisma/enums";
import {
  countsTowardShopCreationRevenue,
  giftedShopSetupPurchaseRevenueWhere,
  paidShopSetupCheckoutWhere,
  shopReactivationPurchaseRevenueWhere,
  shopSetupFeePurchaseRevenueWhere,
} from "@/lib/admin-platform-sales-merged-lines";

describe("paidShopSetupCheckoutWhere", () => {
  it("requires positive amount and checkout proof", () => {
    const where = paidShopSetupCheckoutWhere();
    assert.deepEqual(where.amountCents, { gt: 0 });
    assert.equal(where.OR?.length, 2);
  });
});

describe("shopSetupFeePurchaseRevenueWhere", () => {
  it("filters paid self-signup rows in the UTC window", () => {
    const gte = new Date("2026-06-01T00:00:00.000Z");
    const lte = new Date("2026-06-30T23:59:59.999Z");
    const where = shopSetupFeePurchaseRevenueWhere(gte, lte);
    assert.equal(where.status, ShopSetupFeePurchaseStatus.paid);
    assert.deepEqual(where.paidAt, { not: null, gte, lte });
    assert.deepEqual(where.amountCents, { gt: 0 });
  });
});

describe("giftedShopSetupPurchaseRevenueWhere", () => {
  it("filters paid setup gifts and excludes admin batches", () => {
    const gte = new Date("2026-06-01T00:00:00.000Z");
    const lte = new Date("2026-06-30T23:59:59.999Z");
    const where = giftedShopSetupPurchaseRevenueWhere(gte, lte);
    assert.equal(where.status, CreatorGiftPurchaseStatus.paid);
    assert.equal(where.setupFeeIncluded, true);
    assert.equal(where.isBetaTesterBatch, false);
    assert.equal(where.isWaivedShopFeeBatch, false);
    assert.deepEqual(where.paidAt, { not: null, gte, lte });
  });
});

describe("shopReactivationPurchaseRevenueWhere", () => {
  it("filters paid reactivation rows in the UTC window", () => {
    const gte = new Date("2026-06-01T00:00:00.000Z");
    const lte = new Date("2026-06-30T23:59:59.999Z");
    const where = shopReactivationPurchaseRevenueWhere(gte, lte);
    assert.equal(where.status, ShopReactivationPurchaseStatus.paid);
    assert.deepEqual(where.paidAt, { not: null, gte, lte });
    assert.deepEqual(where.amountCents, { gt: 0 });
  });
});

describe("countsTowardShopCreationRevenue", () => {
  it("includes paid shop reactivation checkout", () => {
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "shop_reactivation",
        status: "paid",
        amountCents: 576,
        stripeCheckoutSessionId: "cs_test_reactivate",
      }),
      true,
    );
  });

  it("includes self-pay checkout", () => {
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "shop_setup_fee",
        status: "paid",
        amountCents: 1576,
        stripeCheckoutSessionId: "cs_test_123",
      }),
      true,
    );
  });

  it("includes paid setup gift purchase", () => {
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "creator_gift",
        status: "paid",
        amountCents: 1576,
        setupFeeIncluded: true,
        isBetaTesterBatch: false,
        isWaivedShopFeeBatch: false,
        stripeCheckoutSessionId: "cs_test_gift",
      }),
      true,
    );
  });

  it("excludes admin beta and waived batches", () => {
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "creator_gift",
        status: "paid",
        amountCents: 0,
        setupFeeIncluded: true,
        isBetaTesterBatch: true,
      }),
      false,
    );
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "creator_gift",
        status: "paid",
        amountCents: 0,
        setupFeeIncluded: true,
        isWaivedShopFeeBatch: true,
      }),
      false,
    );
  });

  it("excludes test script rows without checkout proof", () => {
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "creator_gift",
        status: "paid",
        amountCents: 1500,
        setupFeeIncluded: true,
        isBetaTesterBatch: false,
        isWaivedShopFeeBatch: false,
      }),
      false,
    );
  });

  it("excludes redemption-only paths (no purchase row semantics)", () => {
    assert.equal(
      countsTowardShopCreationRevenue({
        source: "creator_gift",
        status: "paid",
        amountCents: 1500,
        setupFeeIncluded: false,
        stripePaymentIntentId: "pi_test",
      }),
      false,
    );
  });
});
