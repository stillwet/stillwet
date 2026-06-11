import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productSyncFieldsFromAdminCatalogItem } from "@/lib/baseline-listing-product-tags-sync";

describe("productSyncFieldsFromAdminCatalogItem", () => {
  it("copies catalog name and min list price onto stub products", () => {
    assert.deepEqual(
      productSyncFieldsFromAdminCatalogItem({
        name: "  Mug (white, 11 oz)  ",
        itemMinPriceCents: 2500,
      }),
      { name: "Mug (white, 11 oz)", minPriceCents: 2500 },
    );
  });

  it("falls back when catalog name is blank", () => {
    assert.deepEqual(
      productSyncFieldsFromAdminCatalogItem({
        name: "   ",
        itemMinPriceCents: 0,
      }),
      { name: "Listing request", minPriceCents: 0 },
    );
  });
});
