import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listingArtworkCropPayloadToTransformV2,
  listingArtworkTransformV2ToCropPayload,
  parseListingArtworkTransformV2,
} from "@/lib/listing-artwork-v2/transform";

describe("parseListingArtworkTransformV2", () => {
  it("parses valid v2 transform", () => {
    const t = parseListingArtworkTransformV2({
      v: 2,
      pixelCrop: { x: 0, y: 0, width: 1000, height: 800 },
      rotation: 90,
      printWidthPx: 5940,
      printHeightPx: 4200,
      letterboxFill: "white",
    });
    assert.ok(t);
    assert.equal(t!.printWidthPx, 5940);
    assert.equal(t!.letterboxFill, "white");
  });

  it("rejects v1 crop shape without v:2", () => {
    assert.equal(
      parseListingArtworkTransformV2({
        pixelCrop: { x: 0, y: 0, width: 100, height: 100 },
        rotation: 0,
        printWidthPx: 100,
        printHeightPx: 100,
      }),
      null,
    );
  });
});

describe("listingArtworkTransformV2 roundtrip", () => {
  it("roundtrips reference source dimensions", () => {
    const crop = {
      pixelCrop: { x: 10, y: 20, width: 500, height: 400 },
      rotation: 180,
      printWidthPx: 8325,
      printHeightPx: 3225,
      referenceSourceWidthPx: 3000,
      referenceSourceHeightPx: 2000,
    };
    const t = listingArtworkCropPayloadToTransformV2(crop, "transparent");
    const back = listingArtworkTransformV2ToCropPayload(t);
    assert.deepEqual(back, crop);
  });
});
