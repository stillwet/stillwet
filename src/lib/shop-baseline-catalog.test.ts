import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import {
  buildShopBaselineCatalogGroups,
  organizeShopBaselineCatalogByCategory,
  partitionShopBaselineCatalogGroups,
  type AdminBaselineRow,
} from "@/lib/shop-baseline-catalog";

function row(
  id: string,
  name: string,
  printW: number,
  printH: number,
  tags: Array<{ id: string; name: string; slug: string; sortOrder: number }> = [],
  tierOverride: AdminBaselineRow["itemArtworkSourceTierOverride"] = "auto",
): AdminBaselineRow {
  return {
    id,
    name,
    itemExampleListingUrl: null,
    itemMinPriceCents: 1000,
    itemGoodsServicesCostCents: 500,
    itemImageRequirementLabel: null,
    itemPrintAreaWidthPx: printW,
    itemPrintAreaHeightPx: printH,
    itemMinArtworkDpi: null,
    itemArtworkLetterboxFill: ListingArtworkLetterboxFill.transparent,
    itemLargeListingArtwork: false,
    itemArtworkSourceTierOverride: tierOverride,
    catalogTags: tags.map((tag) => ({ tag })),
  };
}

describe("organizeShopBaselineCatalogByCategory", () => {
  it("orders categories by tag sort order and items within alphabetically", () => {
    const groups = buildShopBaselineCatalogGroups([
      row("mug", "Ceramic Mug", 2475, 1155, [{ id: "t-drink", name: "Drinkware", slug: "drinkware", sortOrder: 10 }]),
      row("poster-s", "Small Poster", 4200, 2970, [
        { id: "t-wall", name: "Wall art", slug: "wall-art", sortOrder: 20 },
      ]),
      row("poster-l", "Large Poster", 5940, 4200, [
        { id: "t-wall", name: "Wall art", slug: "wall-art", sortOrder: 20 },
      ]),
      row("blanket", "Blanket", 6400, 8400, [
        { id: "t-home", name: "Home", slug: "home", sortOrder: 30 },
      ]),
    ]);

    const sections = organizeShopBaselineCatalogByCategory(groups);
    assert.deepEqual(
      sections.map((s) => s.categoryName),
      ["Drinkware", "Wall art", "Home"],
    );
    assert.deepEqual(
      sections.find((s) => s.categoryName === "Wall art")?.groups.map((g) => g.itemName),
      ["Large Poster", "Small Poster"],
    );
  });

  it("puts untagged items in Other after tagged categories", () => {
    const groups = buildShopBaselineCatalogGroups([
      row("orphan", "Mystery Item", 1000, 1000),
      row("mug", "Mug", 2475, 1155, [{ id: "t-drink", name: "Drinkware", slug: "drinkware", sortOrder: 10 }]),
    ]);
    const sections = organizeShopBaselineCatalogByCategory(groups);
    assert.equal(sections.at(-1)?.categoryName, "Other");
  });
});

describe("partitionShopBaselineCatalogGroups", () => {
  it("keeps artwork tiers and sorts items by canvas size within each", () => {
    const groups = buildShopBaselineCatalogGroups([
      row("blanket", "Blanket", 6400, 8400, [{ id: "t-home", name: "Home", slug: "home", sortOrder: 30 }]),
      row("mug", "Mug", 2475, 1155, [{ id: "t-drink", name: "Drinkware", slug: "drinkware", sortOrder: 10 }]),
    ]);
    const { phonePicSafe, cameraOrVectorOnly } = partitionShopBaselineCatalogGroups(groups);
    assert.equal(phonePicSafe.length, 1);
    assert.equal(phonePicSafe[0]?.itemName, "Mug");
    assert.equal(cameraOrVectorOnly.length, 1);
    assert.equal(cameraOrVectorOnly[0]?.itemName, "Blanket");
  });

  it("orders items alphabetically within a tier", () => {
    const groups = buildShopBaselineCatalogGroups([
      row("poster-l", "Large Poster", 4200, 2970, [
        { id: "t-wall", name: "Wall art", slug: "wall-art", sortOrder: 20 },
      ]),
      row("mug", "Mug", 2475, 1155, [{ id: "t-drink", name: "Drinkware", slug: "drinkware", sortOrder: 10 }]),
      row("poster-s", "Small Poster", 3600, 2700, [
        { id: "t-wall", name: "Wall art", slug: "wall-art", sortOrder: 20 },
      ]),
    ]);
    const { phonePicSafe } = partitionShopBaselineCatalogGroups(groups);
    assert.deepEqual(
      phonePicSafe.map((g) => g.itemName),
      ["Large Poster", "Mug", "Small Poster"],
    );
  });
});
