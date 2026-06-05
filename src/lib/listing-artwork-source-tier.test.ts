import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_CATALOG_PRINT_AREA_FIXTURES } from "@/lib/admin-catalog-print-areas";
import {
  computedCatalogArtworkSourceTier,
  referencePhoneEffectiveDpiForPrint,
  resolveCatalogArtworkSourceTier,
} from "@/lib/listing-artwork-source-tier";

describe("referencePhoneEffectiveDpiForPrint", () => {
  it("mug-sized print is phone-safe at reference phone resolution", () => {
    const mug = ADMIN_CATALOG_PRINT_AREA_FIXTURES.find((f) => f.name.includes("Ceramic Mug (white, 11 oz)"));
    assert.ok(mug);
    const dpi = referencePhoneEffectiveDpiForPrint(mug.printWidthPx, mug.printHeightPx);
    assert.ok(dpi != null && dpi >= 250);
  });

  it("blanket print is below phone-safe threshold", () => {
    const blanket = ADMIN_CATALOG_PRINT_AREA_FIXTURES.find((f) => f.name.includes("Blanket"));
    assert.ok(blanket);
    const dpi = referencePhoneEffectiveDpiForPrint(blanket.printWidthPx, blanket.printHeightPx);
    assert.ok(dpi != null && dpi < 250);
  });
});

describe("computedCatalogArtworkSourceTier", () => {
  it("classifies mug as phone pic safe and blanket as camera/vector only", () => {
    const mug = ADMIN_CATALOG_PRINT_AREA_FIXTURES.find((f) => f.name.includes("Ceramic Mug (white, 11 oz)"));
    const blanket = ADMIN_CATALOG_PRINT_AREA_FIXTURES.find((f) => f.name.includes("Blanket"));
    assert.ok(mug && blanket);
    assert.equal(
      computedCatalogArtworkSourceTier(mug.printWidthPx, mug.printHeightPx),
      "phone_pic_safe",
    );
    assert.equal(
      computedCatalogArtworkSourceTier(blanket.printWidthPx, blanket.printHeightPx),
      "camera_or_vector_only",
    );
  });

  it("defaults missing print area to phone pic safe", () => {
    assert.equal(computedCatalogArtworkSourceTier(null, null), "phone_pic_safe");
  });
});

describe("resolveCatalogArtworkSourceTier", () => {
  it("honors admin override over computed tier", () => {
    const blanket = ADMIN_CATALOG_PRINT_AREA_FIXTURES.find((f) => f.name.includes("Blanket"));
    assert.ok(blanket);
    assert.equal(
      resolveCatalogArtworkSourceTier({
        itemArtworkSourceTierOverride: "phone_pic_safe",
        printAreaWidthPx: blanket.printWidthPx,
        printAreaHeightPx: blanket.printHeightPx,
      }),
      "phone_pic_safe",
    );
  });
});
