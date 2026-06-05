import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creatorGiftCodeUsageStatus,
  isCreatorGiftCodeExpired,
  isPurchasedShopSetupGiftCodeExpired,
  purchasedShopSetupGiftCodeExpiresAt,
  PURCHASED_SHOP_SETUP_GIFT_CODE_VALIDITY_DAYS,
} from "@/lib/creator-gift-code-expiration";

describe("creator-gift-code-expiration", () => {
  it("expires purchased shop setup codes one year after issuance", () => {
    const from = new Date("2026-01-15T12:00:00.000Z");
    const expiresAt = purchasedShopSetupGiftCodeExpiresAt(from);
    assert.equal(expiresAt.toISOString(), "2027-01-15T12:00:00.000Z");
    assert.equal(PURCHASED_SHOP_SETUP_GIFT_CODE_VALIDITY_DAYS, 365);
  });

  it("treats null expiresAt as never expired", () => {
    assert.equal(isCreatorGiftCodeExpired(null), false);
  });

  it("derives usage status from redemption and expiration", () => {
    const expiresAt = new Date("2026-06-01T00:00:00.000Z");
    const now = new Date("2026-06-05T00:00:00.000Z");

    assert.equal(
      creatorGiftCodeUsageStatus({
        redeemedAt: null,
        expiresAt,
        now,
      }),
      "expired",
    );

    assert.equal(
      creatorGiftCodeUsageStatus({
        redeemedAt: new Date("2026-05-01T00:00:00.000Z"),
        expiresAt,
        now,
      }),
      "used",
    );

    assert.equal(
      creatorGiftCodeUsageStatus({
        redeemedAt: null,
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        now,
      }),
      "unused",
    );
  });

  it("falls back to createdAt when stored expiresAt is missing", () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const now = new Date("2026-06-05T00:00:00.000Z");

    assert.equal(
      isPurchasedShopSetupGiftCodeExpired({
        createdAt,
        now,
      }),
      true,
    );
  });
});
