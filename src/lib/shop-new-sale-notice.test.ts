import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOP_NEW_SALE_NOTICE_KIND,
  shopNewSaleNoticeBody,
} from "@/lib/shop-new-sale-notice-content";

test("shopNewSaleNoticeBody mentions sale and 24 hour dashboard delay", () => {
  const body = shopNewSaleNoticeBody();
  assert.match(body, /Cha-ching!/i);
  assert.match(body, /made a sale/i);
  assert.match(body, /24 hours/i);
  assert.match(body, /dashboard/i);
});

test("new sale notice kind is stable", () => {
  assert.equal(SHOP_NEW_SALE_NOTICE_KIND, "new_sale");
});
