import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { printifyCatalogPickListForListingRow } from "@/lib/shop-listing-printify-mapping-reserved";

describe("printifyCatalogPickListForListingRow", () => {
  const catalog = [
    { id: "p1", title: "Alpha" },
    { id: "p2", title: "Beta" },
    { id: "p3", title: "Gamma" },
  ];

  it("hides mapped ids except the current row selection", () => {
    const out = printifyCatalogPickListForListingRow(catalog, ["p2"], "p1");
    assert.deepEqual(
      out.map((p) => p.id),
      ["p1", "p3"],
    );
  });

  it("keeps the current mapped id visible for resync", () => {
    const out = printifyCatalogPickListForListingRow(catalog, ["p2"], "p2");
    assert.deepEqual(
      out.map((p) => p.id),
      ["p2", "p1", "p3"],
    );
  });

  it("injects a synthetic option when the saved id is missing from live catalog", () => {
    const out = printifyCatalogPickListForListingRow(catalog, [], "gone");
    assert.equal(out[0]?.id, "gone");
    assert.match(out[0]?.title ?? "", /not in live catalog/i);
  });
});
