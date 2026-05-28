import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { listingSupplementPendingImageUrlToObjectKey } from "@/lib/r2-upload";

describe("listingSupplementPendingImageUrlToObjectKey", () => {
  const prevBase = process.env.R2_PUBLIC_BASE_URL;

  afterEach(() => {
    if (prevBase === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = prevBase;
  });

  it("accepts HTTPS URL under configured public base path", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/media";
    const shopId = "shopAbc";
    const listingId = "listingXyz";
    const key = `shops/${shopId}/listing-supplement-pending/${listingId}.webp`;
    const url = `https://cdn.example.com/media/${key}`;
    assert.equal(listingSupplementPendingImageUrlToObjectKey(url, shopId, listingId), key);
  });

  it("rejects canonical live supplement URL (wrong path segment)", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/pub";
    const shopId = "s1";
    const listingId = "l1";
    const url = `https://cdn.example.com/pub/shops/${shopId}/listing-supplement/${listingId}.webp`;
    assert.equal(listingSupplementPendingImageUrlToObjectKey(url, shopId, listingId), null);
  });

  it("rejects URL for a different listing id", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/pub";
    const url = "https://cdn.example.com/pub/shops/s1/listing-supplement-pending/other.webp";
    assert.equal(listingSupplementPendingImageUrlToObjectKey(url, "s1", "expected-id"), null);
  });
});
