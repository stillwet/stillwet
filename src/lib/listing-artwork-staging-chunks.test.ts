import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES,
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES,
} from "@/lib/listing-request-artwork-limits";
import {
  listingArtworkStagingChunkCount,
  listingArtworkStagingChunkRange,
  listingArtworkStagingMaxParts,
} from "@/lib/listing-artwork-staging-chunks";

describe("listingArtworkStagingChunkCount", () => {
  it("returns 1 for small files", () => {
    assert.equal(listingArtworkStagingChunkCount(100), 1);
    assert.equal(listingArtworkStagingChunkCount(LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES), 1);
  });

  it("splits at chunk boundary", () => {
    assert.equal(
      listingArtworkStagingChunkCount(LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES + 1),
      2,
    );
  });

  it("covers max upload size within max parts", () => {
    const parts = listingArtworkStagingChunkCount(LISTING_REQUEST_ARTWORK_UPLOAD_MAX_BYTES);
    assert.ok(parts >= 1);
    assert.ok(parts <= listingArtworkStagingMaxParts());
  });
});

describe("listingArtworkStagingChunkRange", () => {
  it("covers full file without gaps", () => {
    const size = LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES * 3 + 100;
    let covered = 0;
    for (let i = 0; i < listingArtworkStagingChunkCount(size); i++) {
      const r = listingArtworkStagingChunkRange(size, i);
      assert.ok(r);
      assert.equal(r.start, i * LISTING_REQUEST_ARTWORK_STAGING_CHUNK_BYTES);
      covered += r.end - r.start;
    }
    assert.equal(covered, size);
  });
});
