import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOOGLE_SHOPPING_CREDIT_PACKS,
  googleShoppingCreditPackById,
  parseGoogleShoppingCreditPackId,
} from "@/lib/google-shopping-credit-packs";
import {
  isShopGoogleShoppingPurchaseHistoryRow,
  shopGoogleShoppingPurchaseHistoryLabel,
} from "@/lib/shop-google-shopping";

describe("google shopping credit packs", () => {
  it("defines three packs at expected prices", () => {
    assert.equal(GOOGLE_SHOPPING_CREDIT_PACKS.length, 3);
    const pack3 = googleShoppingCreditPackById("gmc_pack_3");
    assert.ok(pack3);
    assert.equal(pack3.credits, 3);
    assert.equal(pack3.priceCents, 500);
    const pack5 = googleShoppingCreditPackById("gmc_pack_5");
    assert.ok(pack5);
    assert.equal(pack5.credits, 5);
    assert.equal(pack5.priceCents, 700);
    const pack10 = googleShoppingCreditPackById("gmc_pack_10");
    assert.ok(pack10);
    assert.equal(pack10.credits, 10);
    assert.equal(pack10.priceCents, 1000);
  });

  it("parses pack ids", () => {
    assert.equal(parseGoogleShoppingCreditPackId("gmc_pack_3"), "gmc_pack_3");
    assert.equal(parseGoogleShoppingCreditPackId(" invalid "), null);
  });
});

describe("shop google shopping", () => {
  it("formats purchase history labels from pack", () => {
    assert.match(
      shopGoogleShoppingPurchaseHistoryLabel({ packId: "gmc_pack_5", creditsGranted: 5 }),
      /5 listing credits/,
    );
  });

  it("recognizes purchase history rows", () => {
    assert.equal(
      isShopGoogleShoppingPurchaseHistoryRow({
        purchaseType: "shop_google_shopping",
        kind: "SHOP_GOOGLE_SHOPPING_PACK",
      }),
      true,
    );
    assert.equal(
      isShopGoogleShoppingPurchaseHistoryRow({ purchaseType: "promotion", kind: "FRONT_PAGE_ITEM" }),
      false,
    );
  });
});
