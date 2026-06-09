import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminCatalogSizeExampleFromPlatformLinks,
  normalizeAdminCatalogImageUrl,
} from "@/lib/admin-catalog-reference-image";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import {
  injectCatalogSizeExampleIntoGallery,
  productImageUrlsForShopListing,
} from "@/lib/product-media";

describe("normalizeAdminCatalogImageUrl", () => {
  it("accepts https and relative paths", () => {
    assert.equal(
      normalizeAdminCatalogImageUrl("https://cdn.example/a.webp"),
      "https://cdn.example/a.webp",
    );
    assert.equal(normalizeAdminCatalogImageUrl("/catalog/mug.webp"), "/catalog/mug.webp");
  });

  it("rejects empty and invalid", () => {
    assert.equal(normalizeAdminCatalogImageUrl(""), null);
    assert.equal(normalizeAdminCatalogImageUrl("ftp://x"), null);
  });
});

describe("adminCatalogSizeExampleFromPlatformLinks", () => {
  it("returns first linked item size example URL", () => {
    assert.equal(
      adminCatalogSizeExampleFromPlatformLinks({
        id: "prod-1",
        adminCatalogItemPlatformLinks: [
          { itemSizeExampleImageUrl: null },
          { itemSizeExampleImageUrl: "https://cdn.example/mug-size.webp" },
        ],
      }),
      "https://cdn.example/mug-size.webp",
    );
  });
});

describe("parseBaselinePick for catalog size example", () => {
  it("parses item-level baseline pick encoding", () => {
    const pick = parseBaselinePick("ab|item-abc|item");
    assert.ok(pick);
    assert.equal(pick.itemId, "item-abc");
  });
});

describe("injectCatalogSizeExampleIntoGallery", () => {
  it("replaces index 1 when gallery has two or more images", () => {
    const out = injectCatalogSizeExampleIntoGallery(
      ["https://printify.example/hero.jpg", "https://printify.example/context-2.jpg"],
      "https://cdn.example/size.webp",
    );
    assert.deepEqual(out, [
      "https://printify.example/hero.jpg",
      "https://cdn.example/size.webp",
    ]);
  });

  it("appends when only one mockup exists", () => {
    const out = injectCatalogSizeExampleIntoGallery(
      ["https://printify.example/hero.jpg"],
      "https://cdn.example/size.webp",
    );
    assert.deepEqual(out, ["https://printify.example/hero.jpg", "https://cdn.example/size.webp"]);
  });
});

describe("productImageUrlsForShopListing size example", () => {
  it("injects size example at index 1 instead of appending", () => {
    const urls = productImageUrlsForShopListing(
      {
        imageUrl: "https://printify.example/hero.webp",
        imageGallery: ["https://printify.example/context-2.webp"],
      },
      { adminCatalogSizeExampleImageUrl: "https://cdn.example/size.webp" },
    );
    assert.equal(urls[0], "https://printify.example/hero.webp");
    assert.equal(urls[1], "https://cdn.example/size.webp");
    assert.equal(urls.length, 2);
  });
});
