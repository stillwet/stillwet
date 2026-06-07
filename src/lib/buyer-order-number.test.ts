import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBuyerOrderNumber,
  formatBuyerOrderNumberShort,
} from "@/lib/buyer-order-number";

test("formatBuyerOrderNumber for Stripe receipt description", () => {
  assert.equal(formatBuyerOrderNumber(1042), "Order #1042");
});

test("formatBuyerOrderNumberShort for inline UI", () => {
  assert.equal(formatBuyerOrderNumberShort(1042), "#1042");
});
