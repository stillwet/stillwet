import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogArtworkSurface } from "@/lib/admin-catalog-artwork-template";
import { CATALOG_CANVAS_PRESENTATION_FLAT } from "@/lib/admin-catalog-canvas-presentation";
import {
  buildListingArtworkBakedSubmitEntries,
  catalogItemIsPillow,
  normalizePillowCatalogArtworkSurfaces,
  pillowPerSidePrintAreaDimensions,
  pillowPrintAreaUsesCombinedSideBySideLayout,
  resolvePillowListingArtworkSurfaces,
} from "@/lib/listing-artwork-pillow-listing";

const frontSurface: CatalogArtworkSurface = {
  id: "front",
  label: "Front",
  required: true,
  printAreaWidthPx: 4650,
  printAreaHeightPx: 2325,
  canvasPresentation: CATALOG_CANVAS_PRESENTATION_FLAT,
};

const squareFrontSurface: CatalogArtworkSurface = {
  ...frontSurface,
  printAreaWidthPx: 2325,
  printAreaHeightPx: 2325,
};

describe("catalogItemIsPillow", () => {
  it("matches pillow catalog items", () => {
    assert.equal(
      catalogItemIsPillow({
        catalogItemName: 'Square Pillow (14"x14")',
        categoryTagSlug: "pillow",
      }),
      true,
    );
    assert.equal(
      catalogItemIsPillow({
        catalogItemName: "Body pillow",
        categoryTagSlug: "home",
      }),
      true,
    );
    assert.equal(
      catalogItemIsPillow({
        catalogItemName: "Ceramic Mug (white, 11 oz)",
        categoryTagSlug: "mugs",
      }),
      false,
    );
  });
});

describe("pillowPerSidePrintAreaDimensions", () => {
  it("detects Printify combined front+back template", () => {
    assert.equal(pillowPrintAreaUsesCombinedSideBySideLayout(4650, 2325), true);
    assert.equal(pillowPrintAreaUsesCombinedSideBySideLayout(8325, 3225), false);
  });

  it("splits combined template to square per-side dimensions", () => {
    assert.deepEqual(
      pillowPerSidePrintAreaDimensions({ printAreaWidthPx: 4650, printAreaHeightPx: 2325 }),
      { printAreaWidthPx: 2325, printAreaHeightPx: 2325 },
    );
  });

  it("normalizes catalog surfaces for square pillow upload", () => {
    const normalized = normalizePillowCatalogArtworkSurfaces([frontSurface]);
    assert.equal(normalized[0]?.printAreaWidthPx, 2325);
    assert.equal(normalized[0]?.printAreaHeightPx, 2325);
  });
});

describe("resolvePillowListingArtworkSurfaces", () => {
  it("single-sided uses front only", () => {
    const resolved = resolvePillowListingArtworkSurfaces({
      catalogSurfaces: [squareFrontSurface],
      pillowDoubleSided: false,
      pillowSidesMode: "same",
    });
    assert.equal(resolved.surfaces.length, 1);
    assert.equal(resolved.duplicateFrontToBackOnSubmit, false);
  });

  it("same design duplicates front to back on submit", () => {
    const resolved = resolvePillowListingArtworkSurfaces({
      catalogSurfaces: [squareFrontSurface],
      pillowDoubleSided: true,
      pillowSidesMode: "same",
    });
    assert.equal(resolved.surfaces.length, 1);
    assert.equal(resolved.duplicateFrontToBackOnSubmit, true);
  });

  it("different design requires front and back surfaces", () => {
    const resolved = resolvePillowListingArtworkSurfaces({
      catalogSurfaces: [squareFrontSurface],
      pillowDoubleSided: true,
      pillowSidesMode: "different",
    });
    assert.equal(resolved.surfaces.length, 2);
    assert.equal(resolved.surfaces[1]?.id, "back");
    assert.equal(resolved.surfaces[1]?.required, true);
    assert.equal(resolved.duplicateFrontToBackOnSubmit, false);
  });

  it("different design requires back even when catalog marks it optional", () => {
    const catalogBack: CatalogArtworkSurface = {
      ...squareFrontSurface,
      id: "back",
      label: "Back",
      required: false,
    };
    const resolved = resolvePillowListingArtworkSurfaces({
      catalogSurfaces: [squareFrontSurface, catalogBack],
      pillowDoubleSided: true,
      pillowSidesMode: "different",
    });
    assert.equal(resolved.surfaces[1]?.required, true);
  });
});

describe("buildListingArtworkBakedSubmitEntries", () => {
  it("duplicates front artwork for same-design pillows", () => {
    const entries = buildListingArtworkBakedSubmitEntries({
      surfaces: [squareFrontSurface],
      surfaceArtwork: {
        front: {
          requestImageKey: "key-front",
          publicUrl: "https://example/front.webp",
        },
      },
      duplicateFrontToBackOnSubmit: true,
    });
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[1], {
      surfaceId: "back",
      requestImageKey: "key-front",
      publicUrl: "https://example/front.webp",
    });
  });
});
