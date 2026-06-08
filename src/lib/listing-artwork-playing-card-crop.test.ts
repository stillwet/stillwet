import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogItemIsDeskMat,
  catalogItemIsMousepad,
  catalogItemIsPlayingCard,
  catalogItemUsesRoundedCornerCropGuide,
  catalogPrintAreaUsesRoundedCornerCropGuide,
  roundedCornerCropGuideWedgePathD,
  roundedCornerCropRadiusPx,
  ROUNDED_CORNER_CROP_RADIUS_FRACTION,
} from "@/lib/listing-artwork-playing-card-crop";

describe("catalogItemIsPlayingCard", () => {
  it("matches playing card names and slugs, not unrelated items", () => {
    assert.equal(
      catalogItemIsPlayingCard({
        catalogItemName: "Poker / Playing Cards",
        categoryTagSlug: "playing-cards",
      }),
      true,
    );
    assert.equal(
      catalogItemIsPlayingCard({
        catalogItemName: "Custom playing card deck",
        categoryTagSlug: "games",
      }),
      true,
    );
    assert.equal(
      catalogItemIsPlayingCard({
        catalogItemName: 'Canvas Print (12")',
        categoryTagSlug: "canvas-print",
      }),
      false,
    );
    assert.equal(
      catalogItemIsPlayingCard({
        catalogItemName: "Ceramic Mug (white, 11 oz)",
        categoryTagSlug: "mugs",
      }),
      false,
    );
  });
});

describe("catalogItemIsMousepad", () => {
  it("matches mousepad names and slugs", () => {
    assert.equal(
      catalogItemIsMousepad({
        catalogItemName: "Gaming Mousepad",
        categoryTagSlug: "mousepad",
      }),
      true,
    );
    assert.equal(
      catalogItemIsMousepad({
        catalogItemName: "Desk mouse pad XL",
        categoryTagSlug: "desk",
      }),
      true,
    );
    assert.equal(
      catalogItemIsMousepad({
        catalogItemName: "Desk Mat",
        categoryTagSlug: "desk",
      }),
      false,
    );
    assert.equal(
      catalogItemIsMousepad({
        catalogItemName: 'Canvas Print (12")',
        categoryTagSlug: "canvas-print",
      }),
      false,
    );
  });
});

describe("catalogItemIsDeskMat", () => {
  it("matches desk mat catalog items", () => {
    assert.equal(
      catalogItemIsDeskMat({
        catalogItemName: "Desk Mat",
        categoryTagSlug: "desk-mat",
      }),
      true,
    );
    assert.equal(
      catalogItemIsDeskMat({
        catalogItemName: "Desk Mat",
        categoryTagSlug: "desk",
      }),
      true,
    );
    assert.equal(
      catalogItemIsDeskMat({
        catalogItemName: "Stitched Edge Deskmat",
        categoryTagSlug: "home",
      }),
      true,
    );
    assert.equal(
      catalogItemIsDeskMat({
        catalogItemName: "Desk Pad XL",
        categoryTagSlug: "desk",
      }),
      true,
    );
    assert.equal(
      catalogItemIsDeskMat({
        catalogItemName: "Gaming Mousepad",
        categoryTagSlug: "mousepad",
      }),
      false,
    );
  });
});

describe("catalogPrintAreaUsesRoundedCornerCropGuide", () => {
  it("matches known print templates including desk mat", () => {
    assert.equal(catalogPrintAreaUsesRoundedCornerCropGuide(4843, 2480), true);
    assert.equal(catalogPrintAreaUsesRoundedCornerCropGuide(2480, 4843), true);
    assert.equal(catalogPrintAreaUsesRoundedCornerCropGuide(3071, 2598), true);
    assert.equal(catalogPrintAreaUsesRoundedCornerCropGuide(4200, 2970), false);
  });

  it("matches desk mat aspect when admin dimensions drift slightly", () => {
    assert.equal(catalogPrintAreaUsesRoundedCornerCropGuide(4800, 2460), true);
    assert.equal(catalogPrintAreaUsesRoundedCornerCropGuide(4200, 2970), false);
  });
});

describe("catalogItemUsesRoundedCornerCropGuide", () => {
  it("includes playing cards, mousepads, and desk mats", () => {
    assert.equal(
      catalogItemUsesRoundedCornerCropGuide({
        catalogItemName: "Poker / Playing Cards",
        categoryTagSlug: "playing-cards",
      }),
      true,
    );
    assert.equal(
      catalogItemUsesRoundedCornerCropGuide({
        catalogItemName: "Gaming Mousepad",
        categoryTagSlug: "mousepad",
      }),
      true,
    );
    assert.equal(
      catalogItemUsesRoundedCornerCropGuide({
        catalogItemName: "Desk Mat",
        categoryTagSlug: "desk-mat",
      }),
      true,
    );
    assert.equal(
      catalogItemUsesRoundedCornerCropGuide({
        catalogItemName: "Renamed listing item",
        categoryTagSlug: "home",
        printAreaWidthPx: 4843,
        printAreaHeightPx: 2480,
      }),
      true,
    );
    assert.equal(
      catalogItemUsesRoundedCornerCropGuide({
        catalogItemName: "Ceramic Mug (white, 11 oz)",
        categoryTagSlug: "mugs",
      }),
      false,
    );
  });
});

describe("roundedCornerCropRadiusPx", () => {
  it("scales from the shorter crop edge", () => {
    assert.equal(roundedCornerCropRadiusPx(775, 1125), 775 * ROUNDED_CORNER_CROP_RADIUS_FRACTION);
    assert.equal(roundedCornerCropRadiusPx(0, 1125), 0);
  });
});

describe("roundedCornerCropGuideWedgePathD", () => {
  it("builds outer rect and inner rounded hole for even-odd corner wedges", () => {
    const d = roundedCornerCropGuideWedgePathD(671, 343, 17.15);
    assert.match(d, /^M 0 0 H 671 V 343 H 0 Z M 17\.15 0/);
    assert.match(d, /A 17\.15 17\.15/);
  });
});
