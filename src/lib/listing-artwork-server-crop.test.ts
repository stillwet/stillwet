import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { parseListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";
import { listingArtworkUseServerSideCrop } from "@/lib/listing-artwork-browser-crop-threshold";
import { cropListingArtworkBufferOnServer } from "@/lib/listing-artwork-server-crop";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";

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

  it("handles extreme zoom-out / pan crop without huge intermediate buffers", async () => {
    const src = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 200, g: 50, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    // Simulates minZoom 0.2 + heavy pan: crop region far larger than source bbox.
    const out = await cropListingArtworkBufferOnServer(src, {
      pixelCrop: { x: -8000, y: -6000, width: 20000, height: 14140 },
      rotation: 0,
      printWidthPx: 420,
      printHeightPx: 297,
    });
    assert.ok(out);

    const meta = await sharp(out!).metadata();
    assert.equal(meta.width, 420);
    assert.equal(meta.height, 297);

    const { data, info } = await sharp(out!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    assert.ok(alphaAt(0, 0) < 255);
    assert.ok(alphaAt(info.width - 1, 0) < 255);
  });

  it("crops and resizes to print pixels with 90° rotation", async () => {
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
      pixelCrop: { x: 50, y: 100, width: 1500, height: 2000 },
      rotation: 90,
      printWidthPx: 420,
      printHeightPx: 297,
    });
    assert.ok(out);

    const meta = await sharp(out!).metadata();
    assert.equal(meta.width, 420);
    assert.equal(meta.height, 297);
  });

  it("uses white letterbox corners when catalog item policy is white", async () => {
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

    const out = await cropListingArtworkBufferOnServer(
      src,
      {
        pixelCrop: { x: -150, y: -100, width: 600, height: 400 },
        rotation: 0,
        printWidthPx: 420,
        printHeightPx: 297,
      },
      { letterboxFill: ListingArtworkLetterboxFill.white },
    );
    assert.ok(out);

    const { data, info } = await sharp(out!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgbAt = (x: number, y: number) => {
      const i = (y * info.width + x) * 4;
      return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
    };
    const corner = rgbAt(0, 0);
    assert.ok(corner.r > 250 && corner.g > 250 && corner.b > 250);
    assert.equal(corner.a, 255);
    const center = rgbAt(Math.floor(info.width / 2), Math.floor(info.height / 2));
    assert.ok(center.r < 240);
  });
});
