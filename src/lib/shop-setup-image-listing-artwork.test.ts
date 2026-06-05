import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { prepareListingRequestArtworkForStorage, cropAndPrepareListingArtworkForStorage } from "@/lib/shop-setup-image";
import { widthHeightPxFromImageBuffer } from "@/lib/artwork-image-dimensions";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";

describe("prepareListingRequestArtworkForStorage", () => {
  it("passes through small PNG without changing dimensions", async () => {
    const input = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 4,
        background: { r: 200, g: 40, b: 40, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await prepareListingRequestArtworkForStorage(input, 10 * 1024 * 1024, 120, 80);
    assert.ok(result);
    const dims = await widthHeightPxFromImageBuffer(result!.body);
    assert.deepEqual(dims, { w: 120, h: 80 });
  });

  it("compresses without resizing when over stored cap", async () => {
    const input = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 10, g: 120, b: 220 },
      },
    })
      .png()
      .toBuffer();

    const tinyCap = Math.max(400, Math.floor(input.length / 3));
    const result = await prepareListingRequestArtworkForStorage(input, tinyCap, 200, 200);
    assert.ok(result, "expected dimension-preserving compression under cap");
    assert.ok(result!.body.length <= tinyCap);
    const dims = await widthHeightPxFromImageBuffer(result!.body);
    assert.deepEqual(dims, { w: 200, h: 200 });
  });

  it("prefers alpha-safe encoding when compressing letterbox artwork over stored cap", async () => {
    const input = await sharp({
      create: {
        width: 420,
        height: 297,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 120,
              height: 80,
              channels: 4,
              background: { r: 220, g: 40, b: 40, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
          left: 150,
          top: 108,
        },
      ])
      .png()
      .toBuffer();

    const tinyCap = Math.max(800, Math.floor(input.length / 4));
    const result = await prepareListingRequestArtworkForStorage(input, tinyCap, 420, 297);
    assert.ok(result, "expected alpha-preserving compression under cap");
    assert.ok(result!.body.length <= tinyCap);
    assert.notEqual(result!.contentType, "image/jpeg");

    const { data, info } = await sharp(result!.body).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    assert.ok(alphaAt(0, 0) < 255, "corner letterbox should stay transparent");
    assert.equal(alphaAt(200, 148), 255, "center artwork should stay opaque");

    const dims = await widthHeightPxFromImageBuffer(result!.body);
    assert.deepEqual(dims, { w: 420, h: 297 });
  });

  it("prefers JPEG when white letterbox policy compresses cropped artwork", async () => {
    const src = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 220, g: 40, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await cropAndPrepareListingArtworkForStorage(
      src,
      {
        pixelCrop: { x: -200, y: -150, width: 1200, height: 900 },
        rotation: 0,
        printWidthPx: 420,
        printHeightPx: 297,
      },
      10 * 1024 * 1024,
      420,
      297,
      ListingArtworkLetterboxFill.white,
    );
    assert.ok(result);
    assert.equal(result!.contentType, "image/jpeg");

    const { data, info } = await sharp(result!.body).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const corner = data[0]!;
    assert.ok(corner > 250);
    assert.equal(data[3], 255);
    assert.equal(info.width, 420);
    assert.equal(info.height, 297);
  });
});
