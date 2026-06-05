import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import {
  catalogItemNameSuggestsWhiteLetterbox,
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

describe("printAreaSuggestsWhiteLetterbox", () => {
  it("flags poster-sized templates", () => {
    assert.equal(printAreaSuggestsWhiteLetterbox(4200, 2970), true);
    assert.equal(printAreaSuggestsWhiteLetterbox(1200, 800), false);
  });
});
