import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAdminCatalogItemSecretMenuOnlyForm,
  shopHasSecretMenuAccess,
  SHOP_EXTENDED_CATALOG_SECTION_LABEL,
} from "@/lib/secret-menu-catalog";

describe("shopHasSecretMenuAccess", () => {
  it("is true when granted timestamp is set", () => {
    assert.equal(
      shopHasSecretMenuAccess({ secretMenuAccessGrantedAt: new Date("2026-01-01T00:00:00Z") }),
      true,
    );
  });

  it("is false when not granted", () => {
    assert.equal(shopHasSecretMenuAccess({ secretMenuAccessGrantedAt: null }), false);
  });
});

describe("parseAdminCatalogItemSecretMenuOnlyForm", () => {
  it("parses truthy form values", () => {
    const fd = new FormData();
    fd.set("itemSecretMenuOnly", "1");
    assert.equal(parseAdminCatalogItemSecretMenuOnlyForm(fd), true);
  });

  it("defaults to false", () => {
    assert.equal(parseAdminCatalogItemSecretMenuOnlyForm(new FormData()), false);
  });
});

describe("SHOP_EXTENDED_CATALOG_SECTION_LABEL", () => {
  it("does not mention secret menu", () => {
    assert.equal(SHOP_EXTENDED_CATALOG_SECTION_LABEL.toLowerCase().includes("secret"), false);
  });
});
