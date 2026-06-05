import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { prepareListingRequestArtworkForStorage } from "@/lib/shop-setup-image";
import { widthHeightPxFromImageBuffer } from "@/lib/artwork-image-dimensions";

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
});
