import assert from "node:assert/strict";
import test from "node:test";
import {
  printifyOrderExternalId,
  printifyOrderLabel,
  PRINTIFY_ORDER_LABEL_SHOP_NAME_MAX_LEN,
} from "@/lib/printify-order-label";

test("printifyOrderLabel uses shop display name and order number", () => {
  assert.equal(printifyOrderLabel("Xtina Test", 1042), "Xtina Test - 1042");
});

test("printifyOrderLabel falls back when display name is empty", () => {
  assert.equal(printifyOrderLabel("   ", 7), "Your shop - 7");
});

test("printifyOrderLabel truncates long shop names", () => {
  const longName = "A".repeat(PRINTIFY_ORDER_LABEL_SHOP_NAME_MAX_LEN + 10);
  const label = printifyOrderLabel(longName, 99);
  assert.match(label, /^A{47}… - 99$/);
});

test("printifyOrderExternalId is the order number string", () => {
  assert.equal(printifyOrderExternalId(1042), "1042");
});
