import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listingArtworkCropExtractRegionForRotatedImage,
  listingArtworkCropPixelCropForSourceDimensions,
} from "@/lib/listing-artwork-crop-math";

describe("listingArtworkCropExtractRegionForRotatedImage", () => {
  it("preserves print aspect ratio for gloss poster crop", () => {
    const printWidthPx = 5940;
    const printHeightPx = 4200;
    const region = listingArtworkCropExtractRegionForRotatedImage({
      pixelCrop: { x: 120, y: 80, width: 1414, height: 1000 },
      sourceWidthPx: 4000,
      sourceHeightPx: 3000,
      rotationDeg: 0,
      rotatedWidthPx: 4000,
      rotatedHeightPx: 3000,
      printWidthPx,
      printHeightPx,
    });
    assert.ok(region);
    const aspect = region!.width / region!.height;
    const printAspect = printWidthPx / printHeightPx;
    assert.ok(Math.abs(aspect - printAspect) < 0.02);
  });

  it("scales crop coords when sharp rotated canvas size differs from browser bbox", () => {
    const region = listingArtworkCropExtractRegionForRotatedImage({
      pixelCrop: { x: 50, y: 40, width: 800, height: 600 },
      sourceWidthPx: 2000,
      sourceHeightPx: 1500,
      rotationDeg: 15,
      rotatedWidthPx: 1988,
      rotatedHeightPx: 1710,
      printWidthPx: 5940,
      printHeightPx: 4200,
    });
    assert.ok(region);
    assert.ok(region!.width > 0 && region!.height > 0);
  });

  it("keeps zoomed-out letterbox crop region without shrinking to bbox", () => {
    const region = listingArtworkCropExtractRegionForRotatedImage({
      pixelCrop: { x: -200, y: -150, width: 3400, height: 2400 },
      sourceWidthPx: 3000,
      sourceHeightPx: 2000,
      rotationDeg: 0,
      rotatedWidthPx: 3000,
      rotatedHeightPx: 2000,
      printWidthPx: 4200,
      printHeightPx: 2970,
    });
    assert.ok(region);
    assert.equal(region!.x, -200);
    assert.equal(region!.y, -150);
    assert.equal(region!.width, 3400);
    assert.equal(region!.height, 2400);
  });
});

describe("listingArtworkCropPixelCropForSourceDimensions", () => {
  it("returns crop unchanged when reference matches decoded source", () => {
    const crop = { x: 10, y: 20, width: 800, height: 600 };
    const mapped = listingArtworkCropPixelCropForSourceDimensions({
      pixelCrop: crop,
      sourceWidthPx: 4000,
      sourceHeightPx: 3000,
      referenceSourceWidthPx: 4000,
      referenceSourceHeightPx: 3000,
    });
    assert.deepEqual(mapped, crop);
  });

  it("scales crop coords when staging recompress shrinks the source", () => {
    const mapped = listingArtworkCropPixelCropForSourceDimensions({
      pixelCrop: { x: 100, y: 50, width: 2000, height: 1500 },
      sourceWidthPx: 2000,
      sourceHeightPx: 1500,
      referenceSourceWidthPx: 4000,
      referenceSourceHeightPx: 3000,
    });
    assert.equal(mapped.x, 50);
    assert.equal(mapped.y, 25);
    assert.equal(mapped.width, 1000);
    assert.equal(mapped.height, 750);
  });
});
