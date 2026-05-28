import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOP_NEW_SALE_NOTICE_KIND,
  shopNewSaleNoticeBody,
} from "@/lib/shop-new-sale-notice-content";

test("shopNewSaleNoticeBody mentions Sales tab and 24 hours", () => {
  const body = shopNewSaleNoticeBody();
  assert.match(body, /Sales tab/i);
  assert.match(body, /24 hours/i);
  assert.match(body, /\[Sales tab\]\(/);
});

test("new sale notice kind is stable", () => {
  assert.equal(SHOP_NEW_SALE_NOTICE_KIND, "new_sale");
});
