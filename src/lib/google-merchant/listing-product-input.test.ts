import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GoogleMerchantConfig } from "@/lib/google-merchant/config";
import {
  buildGoogleMerchantProductInput,
  hashGoogleMerchantProductInput,
} from "@/lib/google-merchant/listing-product-input";
import { ListingRequestStatus } from "@/generated/prisma/enums";

const testConfig: GoogleMerchantConfig = {
  enabled: true,
  accountId: "123",
  dataSourceId: "456",
  dataSourceName: "accounts/123/dataSources/456",
  feedLabel: "US",
  contentLanguage: "en",
  defaultProductCategory: "Apparel & Accessories",
  serviceAccount: { clientEmail: "test@example.com", privateKey: "" },
};

describe("google merchant listing product input", () => {
  it("maps one listing to a single ProductInput", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://stillwet.com";

    const source = {
      enrollmentId: "enr_1",
      shopListingId: "listing_abc",
      gmcOfferId: "listing_abc",
      shopSlug: "xtina-test",
      shopDisplayName: "Xtina Test",
      shopActive: true,
      shopStripeConnectAccountId: "acct_test",
      shopConnectChargesEnabled: true,
      listing: {
        priceCents: 2499,
        active: true,
        requestStatus: ListingRequestStatus.approved,
        creatorRemovedFromShopAt: null,
        adminRemovedFromShopAt: null,
        hiddenStorefrontForAccountDeletionAt: null,
        requestItemName: "Cool Mug",
        storefrontItemBlurb: "A very cool mug.",
      },
      product: {
        slug: "cool-mug",
        name: "Mug template",
        imageUrl: "https://cdn.stillwet.com/mug.webp",
        imageGallery: null,
      },
      description: "Catalog description.",
    };

    const built = buildGoogleMerchantProductInput(source, testConfig);
    assert.ok(!("error" in built));
    assert.equal(built.offerId, "listing_abc");
    assert.equal(built.productAttributes.title, "Cool Mug");
    assert.equal(built.productAttributes.price.amountMicros, "24990000");
    assert.equal(built.productAttributes.availability, "IN_STOCK");
    assert.equal(built.productAttributes.identifierExists, false);
    assert.equal(
      built.productAttributes.link,
      "https://stillwet.com/s/xtina-test/product/cool-mug",
    );

    const h1 = hashGoogleMerchantProductInput(built);
    const h2 = hashGoogleMerchantProductInput(built);
    assert.equal(h1, h2);
  });

  it("requires HTTPS image", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://stillwet.com";
    const source = {
      enrollmentId: "enr_1",
      shopListingId: "listing_abc",
      gmcOfferId: "listing_abc",
      shopSlug: "shop",
      shopDisplayName: "Shop",
      shopActive: true,
      shopStripeConnectAccountId: "acct_test",
      shopConnectChargesEnabled: true,
      listing: {
        priceCents: 1000,
        active: true,
        requestStatus: ListingRequestStatus.approved,
        creatorRemovedFromShopAt: null,
        adminRemovedFromShopAt: null,
        hiddenStorefrontForAccountDeletionAt: null,
        requestItemName: "Item",
        storefrontItemBlurb: null,
      },
      product: {
        slug: "item",
        name: "Item",
        imageUrl: "http://insecure.example.com/x.jpg",
        imageGallery: null,
      },
    };

    const built = buildGoogleMerchantProductInput(source, testConfig);
    assert.ok("error" in built);
  });
});
