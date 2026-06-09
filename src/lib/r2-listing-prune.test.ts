import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeOrphanR2KeysByPrefix } from "@/lib/r2-listing-prune";

describe("summarizeOrphanR2KeysByPrefix", () => {
  it("groups by first path segment", () => {
    assert.deepEqual(
      summarizeOrphanR2KeysByPrefix([
        "shops/abc/avatar.webp",
        "shops/def/listing-request/x.webp",
        "admin-catalog/item-1/reference.webp",
        "site/still-wet-logo-2048.png",
      ]),
      {
        "shops/": 2,
        "admin-catalog/": 1,
        "site/": 1,
      },
    );
  });
});
