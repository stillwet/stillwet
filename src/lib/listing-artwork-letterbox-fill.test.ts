import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import {
  catalogItemIsBlackMug,
  catalogItemIsWhiteMug,
  catalogItemIsCanvasPrint,
  catalogItemNameSuggestsWhiteLetterbox,
  defaultLetterboxFillForCatalogItemName,
  printAreaSuggestsWhiteLetterbox,
  resolveListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";

describe("resolveListingArtworkLetterboxFill", () => {
  it("uses white for blankets and body pillows by name", () => {
    assert.equal(
      resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
        catalogItemName: "Sherpa blanket",
      }),
      ListingArtworkLetterboxFill.white,
    );
    assert.equal(
      resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
        catalogItemName: "Body pillow",
      }),
      ListingArtworkLetterboxFill.white,
    );
  });

  it("keeps apparel transparent at large print dimensions", () => {
    assert.equal(
      resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
        catalogItemName: "Domme tee",
        printAreaWidthPx: 4500,
        printAreaHeightPx: 5400,
      }),
      ListingArtworkLetterboxFill.transparent,
    );
  });

  it("uses opaque white for white ceramic mugs (white ink is not printed)", () => {
    assert.equal(
      resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
        catalogItemName: "Ceramic Mug (white, 11 oz)",
      }),
      ListingArtworkLetterboxFill.white,
    );
    assert.equal(
      defaultLetterboxFillForCatalogItemName("Ceramic Mug (white, 11 oz)"),
      ListingArtworkLetterboxFill.white,
    );
  });

  it("keeps black mugs transparent for PNG export", () => {
    assert.equal(
      resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
        catalogItemName: "Ceramic Mug (Black, 11 oz)",
      }),
      ListingArtworkLetterboxFill.transparent,
    );
  });

  it("uses white for large non-apparel print areas", () => {
    assert.equal(
      resolveListingArtworkLetterboxFill({
        itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
        catalogItemName: "Limited run",
        printAreaWidthPx: 4200,
        printAreaHeightPx: 2970,
      }),
      ListingArtworkLetterboxFill.white,
    );
  });
});

describe("catalogItemNameSuggestsWhiteLetterbox", () => {
  it("matches fleece and tapestry", () => {
    assert.equal(catalogItemNameSuggestsWhiteLetterbox("Fleece blanket"), true);
    assert.equal(catalogItemNameSuggestsWhiteLetterbox("Wall tapestry"), true);
    assert.equal(catalogItemNameSuggestsWhiteLetterbox("Ceramic mug"), false);
  });
});

describe("catalogItemIsCanvasPrint", () => {
  it("matches canvas print category and names, not mugs", () => {
    assert.equal(
      catalogItemIsCanvasPrint({
        catalogItemName: 'Canvas Print (12")',
        categoryTagSlug: "canvas-print",
      }),
      true,
    );
    assert.equal(
      catalogItemIsCanvasPrint({
        catalogItemName: 'Gallery canvas wrap 24x16',
        categoryTagSlug: "wall-art",
      }),
      true,
    );
    assert.equal(
      catalogItemIsCanvasPrint({
        catalogItemName: "Ceramic Mug (white, 11 oz)",
        categoryTagSlug: "mugs",
      }),
      false,
    );
    assert.equal(
      catalogItemIsCanvasPrint({
        catalogItemName: "Sherpa blanket",
        categoryTagSlug: "blankets",
      }),
      false,
    );
  });
});

describe("catalogItemIsBlackMug", () => {
  it("matches black mug catalog items only", () => {
    assert.equal(catalogItemIsBlackMug({ catalogItemName: "Ceramic Mug (Black, 11 oz)" }), true);
    assert.equal(catalogItemIsBlackMug({ catalogItemName: "Ceramic Mug (white, 11 oz)" }), false);
    assert.equal(catalogItemIsBlackMug({ catalogItemName: "Gloss Poster (16.5 x 11.7)" }), false);
  });
});

describe("catalogItemIsWhiteMug", () => {
  it("matches white mug catalog items only", () => {
    assert.equal(catalogItemIsWhiteMug({ catalogItemName: "Ceramic Mug (white, 11 oz)" }), true);
    assert.equal(catalogItemIsWhiteMug({ catalogItemName: "Ceramic Mug (Black, 11 oz)" }), false);
    assert.equal(catalogItemIsWhiteMug({ catalogItemName: "Gloss Poster (16.5 x 11.7)" }), false);
  });
});

describe("printAreaSuggestsWhiteLetterbox", () => {
  it("flags poster-sized templates", () => {
    assert.equal(printAreaSuggestsWhiteLetterbox(4200, 2970), true);
    assert.equal(printAreaSuggestsWhiteLetterbox(1200, 800), false);
  });
});
