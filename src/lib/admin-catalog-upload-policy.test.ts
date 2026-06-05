import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_CATALOG_PRINT_AREA_FIXTURES } from "@/lib/admin-catalog-print-areas";
import { listingArtworkUseServerSideCrop } from "@/lib/listing-artwork-browser-crop-threshold";

describe("admin catalog upload policy", () => {
  it("every catalog print template uses server-side crop (even with a small source file)", () => {
    for (const item of ADMIN_CATALOG_PRINT_AREA_FIXTURES) {
      const server = listingArtworkUseServerSideCrop(
        item.printWidthPx,
        item.printHeightPx,
        512 * 1024,
      );
      assert.equal(
        server,
        true,
        `${item.name} (${item.printWidthPx}×${item.printHeightPx}) must use server crop`,
      );
    }
  });

  it("large decoded sources without a print template still use server crop", () => {
    assert.equal(listingArtworkUseServerSideCrop(0, 0, 512 * 1024, 4000, 3000), true);
  });
});
