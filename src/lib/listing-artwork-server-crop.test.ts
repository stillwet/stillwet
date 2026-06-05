import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { parseListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import { listingArtworkUseServerSideCrop } from "@/lib/listing-artwork-browser-crop-threshold";
import { cropListingArtworkBufferOnServer } from "@/lib/listing-artwork-server-crop";

describe("listingArtworkUseServerSideCrop", () => {
  it("always uses server crop when a print template is configured", () => {
    assert.equal(listingArtworkUseServerSideCrop(2475, 1155, 512 * 1024), true);
    assert.equal(listingArtworkUseServerSideCrop(5940, 4200, 512 * 1024), true);
  });

  it("uses server crop for large sources or decoded pixels without a print template", () => {
    assert.equal(listingArtworkUseServerSideCrop(0, 0, 7 * 1024 * 1024), true);
    assert.equal(listingArtworkUseServerSideCrop(0, 0, 512 * 1024, 4000, 3000), true);
  });

  it("allows browser crop only without a print template and small source", () => {
    assert.equal(listingArtworkUseServerSideCrop(0, 0, 2 * 1024 * 1024, 1200, 800), false);
  });
});

describe("parseListingArtworkCropPayload", () => {
  it("parses valid crop json", () => {
    const parsed = parseListingArtworkCropPayload({
      pixelCrop: { x: 10, y: 20, width: 800, height: 600 },
      rotation: 90,
      printWidthPx: 5940,
      printHeightPx: 4200,
    });
    assert.ok(parsed);
    assert.equal(parsed?.printWidthPx, 5940);
    assert.equal(parsed?.rotation, 90);
  });

  it("rejects invalid crop json", () => {
    assert.equal(parseListingArtworkCropPayload({ pixelCrop: { x: 0 } }), null);
  });
});

describe("cropListingArtworkBufferOnServer", () => {
  it("crops and resizes to print pixels", async () => {
    const src = await sharp({
      create: {
        width: 2000,
        height: 1500,
        channels: 3,
        background: { r: 200, g: 50, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    const out = await cropListingArtworkBufferOnServer(src, {
      pixelCrop: { x: 100, y: 50, width: 1414, height: 1000 },
      rotation: 0,
      printWidthPx: 5940,
      printHeightPx: 4200,
    });
    assert.ok(out);
    const meta = await sharp(out!).metadata();
    assert.equal(meta.width, 5940);
    assert.equal(meta.height, 4200);
  });

  it("preserves transparent letterbox corners when zoomed out", async () => {
    const src = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 220, g: 40, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const out = await cropListingArtworkBufferOnServer(src, {
      pixelCrop: { x: -150, y: -100, width: 600, height: 400 },
      rotation: 0,
      printWidthPx: 420,
      printHeightPx: 297,
    });
    assert.ok(out);

    const { data, info } = await sharp(out!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    assert.ok(alphaAt(0, 0) < 255);
    assert.ok(alphaAt(info.width - 1, info.height - 1) < 255);
    assert.equal(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)), 255);
  });
});
