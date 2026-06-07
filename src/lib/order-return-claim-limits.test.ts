import assert from "node:assert/strict";
import test from "node:test";
import {
  ORDER_RETURN_CLAIM_MAX_DAYS_FROM_ORDER,
  daysSinceOrderPlaced,
  isWithinOrderReturnClaimWindow,
} from "@/lib/order-return-claim-limits";
import {
  buyerOrderEmailMatches,
  buyerOrderNameMatches,
  parseBuyerOrderNumberInput,
} from "@/lib/order-return-claim-validation";

test("parseBuyerOrderNumberInput accepts common formats", () => {
  assert.equal(parseBuyerOrderNumberInput("#1234"), 1234);
  assert.equal(parseBuyerOrderNumberInput("Order #1234"), 1234);
  assert.equal(parseBuyerOrderNumberInput("1234"), 1234);
  assert.equal(parseBuyerOrderNumberInput(""), null);
  assert.equal(parseBuyerOrderNumberInput("abc"), null);
});

test("buyer order identity checks are case-insensitive", () => {
  assert.equal(buyerOrderEmailMatches("Buyer@Example.com", "buyer@example.com"), true);
  assert.equal(buyerOrderNameMatches("  Jane   Doe ", "jane doe"), true);
  assert.equal(buyerOrderNameMatches("Jane Doe", "John Doe"), false);
});

test("claim window uses 21 days from order placed", () => {
  const placed = new Date("2026-01-01T12:00:00.000Z");
  const day20 = new Date("2026-01-21T11:00:00.000Z");
  const day22 = new Date("2026-01-23T12:00:00.000Z");
  assert.equal(ORDER_RETURN_CLAIM_MAX_DAYS_FROM_ORDER, 21);
  assert.equal(daysSinceOrderPlaced(placed, day20), 19);
  assert.equal(isWithinOrderReturnClaimWindow(placed, day20), true);
  assert.equal(isWithinOrderReturnClaimWindow(placed, day22), false);
});
