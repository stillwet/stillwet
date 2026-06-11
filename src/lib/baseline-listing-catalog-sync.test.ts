import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productSyncFieldsFromAdminCatalogItem } from "@/lib/baseline-listing-product-tags-sync";

describe("productSyncFieldsFromAdminCatalogItem", () => {
  it("copies catalog name, min list price, and reference price onto stub products", () => {
    assert.deepEqual(
      productSyncFieldsFromAdminCatalogItem({
        name: "  Mug (white, 11 oz)  ",
        itemMinPriceCents: 2500,
      }),
      { name: "Mug (white, 11 oz)", minPriceCents: 2500, priceCents: 2500 },
    );
  });

  it("uses $1 reference price when catalog min is zero", () => {
    assert.deepEqual(
      productSyncFieldsFromAdminCatalogItem({
        name: "   ",
        itemMinPriceCents: 0,
      }),
      { name: "Listing request", minPriceCents: 0, priceCents: 1 },
    );
  });
});
