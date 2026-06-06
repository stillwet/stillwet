import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeListingArtworkCropViewportSize, listingArtworkComposeCropSize } from "@/lib/listing-artwork-crop-viewport";

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

  it("skips viewport cropSize override for phone-sized sources", () => {
    const viewport = { width: 396, height: 520 };
    assert.equal(
      listingArtworkComposeCropSize({
        viewportCropSize: viewport,
        naturalWidth: 608,
        naturalHeight: 912,
      }),
      undefined,
    );
  });

  it("skips viewport cropSize override for large sources", () => {
    const viewport = { width: 396, height: 520 };
    assert.equal(
      listingArtworkComposeCropSize({
        viewportCropSize: viewport,
        naturalWidth: 6000,
        naturalHeight: 6000,
      }),
      undefined,
    );
  });

  it("keeps viewport cropSize override for tiny clipart", () => {
    const viewport = { width: 396, height: 520 };
    assert.deepEqual(
      listingArtworkComposeCropSize({
        viewportCropSize: viewport,
        naturalWidth: 320,
        naturalHeight: 240,
      }),
      viewport,
    );
  });
});
