import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_ARTWORK_V2_SOURCE_MAX_BYTES,
  listingArtworkComposeSourceApiUrl,
  listingArtworkV2DecodeCapError,
  listingArtworkV2DecodePixelsWithinCap,
  listingArtworkV2SourceWithinCap,
} from "@/lib/listing-artwork-v2/limits";
import {
  LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS,
  LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES,
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS,
  LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES,
  isBlanketCatalogPrintArea,
  listingArtworkDecodeMaxPixelsForPrintArea,
  listingArtworkSourceMaxBytesForPrintArea,
} from "@/lib/listing-request-artwork-limits";

describe("listingArtworkV2SourceWithinCap", () => {
  it("allows up to 50 MB by default", () => {
    assert.equal(listingArtworkV2SourceWithinCap(LISTING_ARTWORK_V2_SOURCE_MAX_BYTES), true);
    assert.equal(listingArtworkV2SourceWithinCap(LISTING_ARTWORK_V2_SOURCE_MAX_BYTES + 1), false);
  });

  it("allows up to 100 MB for blanket print template", () => {
    assert.equal(listingArtworkV2SourceWithinCap(LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES, LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES), true);
    assert.equal(
      listingArtworkV2SourceWithinCap(LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES + 1, LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES),
      false,
    );
  });
});

describe("blanket catalog print area helpers", () => {
  it("detects velveteen blanket template only", () => {
    assert.equal(isBlanketCatalogPrintArea(6400, 8400), true);
    assert.equal(isBlanketCatalogPrintArea(8400, 6400), false);
    assert.equal(isBlanketCatalogPrintArea(6400, 6300), false);
  });

  it("raises decode and source caps for blanket only", () => {
    assert.equal(
      listingArtworkDecodeMaxPixelsForPrintArea(6400, 8400, "camera_or_vector_only"),
      LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS,
    );
    assert.equal(
      listingArtworkDecodeMaxPixelsForPrintArea(null, null, "camera_or_vector_only", "Velveteen Blanket"),
      LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS,
    );
    assert.equal(
      listingArtworkDecodeMaxPixelsForPrintArea(5000, 7000, "camera_or_vector_only"),
      LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES,
    );
    assert.equal(listingArtworkSourceMaxBytesForPrintArea(6400, 8400), LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES);
    assert.equal(
      listingArtworkSourceMaxBytesForPrintArea(null, null, "Microfiber Blanket"),
      LISTING_ARTWORK_BLANKET_SOURCE_MAX_BYTES,
    );
  });
});

describe("listingArtworkV2DecodePixelsWithinCap", () => {
  it("uses 24 MP cap for phone-safe items by default", () => {
    assert.equal(listingArtworkV2DecodePixelsWithinCap(6000, 4000), true);
    assert.equal(listingArtworkV2DecodePixelsWithinCap(4096, 6144), false);
  });

  it("uses 54 MP cap for camera/vector only items", () => {
    assert.equal(
      listingArtworkV2DecodePixelsWithinCap(6400, 8400, LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES),
      true,
    );
    assert.equal(
      listingArtworkV2DecodePixelsWithinCap(4096, 6144, LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES),
      true,
    );
  });

  it("rejects oversized decode for high-res tier", () => {
    assert.equal(
      listingArtworkV2DecodePixelsWithinCap(8000, 8000, LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES),
      false,
    );
    const msg = listingArtworkV2DecodeCapError(8000, 8000, LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS_HIGH_RES);
    assert.match(msg, /64\.0 megapixels/);
    assert.match(msg, /blanket catalog item/i);
  });

  it("allows 8192×8192 for blanket decode cap", () => {
    assert.equal(
      listingArtworkV2DecodePixelsWithinCap(8192, 8192, LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS),
      true,
    );
    assert.equal(
      listingArtworkV2DecodePixelsWithinCap(8193, 8192, LISTING_ARTWORK_BLANKET_DECODE_MAX_PIXELS),
      false,
    );
  });

  it("phone-safe error hints at camera/vector catalog section", () => {
    const msg = listingArtworkV2DecodeCapError(4096, 6144, LISTING_ARTWORK_SERVER_DECODE_MAX_PIXELS);
    assert.match(msg, /Camera \/ vector only/i);
  });
});

describe("listingArtworkComposeSourceApiUrl", () => {
  it("returns same-origin compose URL", () => {
    assert.equal(
      listingArtworkComposeSourceApiUrl("shops/x/listing-source/y.jpeg"),
      "/api/dashboard/listing-artwork/source?sourceKey=shops%2Fx%2Flisting-source%2Fy.jpeg",
    );
  });
});
