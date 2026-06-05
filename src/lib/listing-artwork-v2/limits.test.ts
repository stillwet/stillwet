import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_ARTWORK_V2_SOURCE_MAX_BYTES,
  listingArtworkV2DecodeCapError,
  listingArtworkV2DecodePixelsWithinCap,
  listingArtworkV2SourceWithinCap,
} from "@/lib/listing-artwork-v2/limits";

describe("listingArtworkV2SourceWithinCap", () => {
  it("allows up to 50 MB", () => {
    assert.equal(listingArtworkV2SourceWithinCap(LISTING_ARTWORK_V2_SOURCE_MAX_BYTES), true);
    assert.equal(listingArtworkV2SourceWithinCap(LISTING_ARTWORK_V2_SOURCE_MAX_BYTES + 1), false);
  });
});

describe("listingArtworkV2DecodePixelsWithinCap", () => {
  it("allows 24 MP sources", () => {
    assert.equal(listingArtworkV2DecodePixelsWithinCap(6000, 4000), true);
  });

  it("rejects oversized decode", () => {
    assert.equal(listingArtworkV2DecodePixelsWithinCap(8000, 8000), false);
    const msg = listingArtworkV2DecodeCapError(8000, 8000);
    assert.match(msg, /64\.0 megapixels/);
  });
});
