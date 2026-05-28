import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StorefrontViewTargetKind } from "@/generated/prisma/enums";

describe("storefront view events", () => {
  it("exports target kinds used by API routes", () => {
    assert.equal(StorefrontViewTargetKind.product, "product");
    assert.equal(StorefrontViewTargetKind.shop, "shop");
  });
});
