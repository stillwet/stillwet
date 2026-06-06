import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeListingArtworkCropViewportSize } from "@/lib/listing-artwork-crop-viewport";

describe("computeListingArtworkCropViewportSize", () => {
  it("fills a wide container height for portrait print aspect", () => {
    const size = computeListingArtworkCropViewportSize(800, 400, 6400 / 8400);
    assert.ok(size);
    assert.equal(Math.round(size.height), 400);
    assert.ok(Math.abs(size.width / size.height - 6400 / 8400) < 0.001);
  });

  it("fills container width for landscape print aspect in tall container", () => {
    const size = computeListingArtworkCropViewportSize(400, 800, 16 / 9);
    assert.ok(size);
    assert.equal(Math.round(size.width), 400);
    assert.ok(Math.abs(size.width / size.height - 16 / 9) < 0.001);
  });
});
