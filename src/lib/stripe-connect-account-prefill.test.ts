import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creatorShopPublicUrl,
  isStripePrefillableWebsiteOrigin,
  stripeConnectAccountCreateParams,
  stripeConnectAccountLinkCreateParams,
  stripeConnectAccountLinkType,
  stripeConnectAccountUpdateParams,
  stripeConnectBusinessWebsiteUrl,
  STRIPE_CONNECT_CLOTHING_ACCESSORIES_MCC,
} from "@/lib/stripe-connect-account-prefill";

describe("stripe-connect-account-prefill", () => {
  it("builds shop homepage URL for business_profile.url", () => {
    assert.equal(
      creatorShopPublicUrl("https://stillwet.com", "cool-shop"),
      "https://stillwet.com/s/cool-shop",
    );
  });

  it("rejects localhost for Stripe business website prefill", () => {
    assert.equal(isStripePrefillableWebsiteOrigin("http://localhost:3000"), false);
    assert.equal(isStripePrefillableWebsiteOrigin("https://stillwet.com"), true);
  });

  it("prefills email, individual, clothing MCC, and shop URL on create", () => {
    const input = {
      shopId: "shop_1",
      shopSlug: "cool-shop",
      shopDisplayName: "Cool Shop",
      ownerEmail: "creator@example.com",
      appOrigin: "https://stillwet.com",
      country: "US",
    };
    const params = stripeConnectAccountCreateParams(input);
    assert.equal(params.email, "creator@example.com");
    assert.equal(params.business_type, "individual");
    assert.equal(params.business_profile?.mcc, STRIPE_CONNECT_CLOTHING_ACCESSORIES_MCC);
    assert.equal(params.business_profile?.url, "https://stillwet.com/s/cool-shop");
    assert.equal(params.business_profile?.name, "Cool Shop");
    assert.equal(params.business_profile?.product_description, undefined);
  });

  it("uses product_description instead of url when origin is not prefillable", () => {
    const input = {
      shopId: "shop_1",
      shopSlug: "cool-shop",
      shopDisplayName: "Cool Shop",
      ownerEmail: "creator@example.com",
      appOrigin: "http://localhost:3000",
      country: "US",
    };
    assert.equal(stripeConnectBusinessWebsiteUrl(input), undefined);
    const params = stripeConnectAccountCreateParams(input);
    assert.equal(params.business_profile?.url, undefined);
    assert.ok(params.business_profile?.product_description);
  });

  it("uses account_onboarding when charges or payouts are disabled", () => {
    assert.equal(
      stripeConnectAccountLinkType({
        details_submitted: true,
        charges_enabled: false,
        payouts_enabled: false,
      }),
      "account_onboarding",
    );
  });

  it("omits collection_options for account_update links", () => {
    const params = stripeConnectAccountLinkCreateParams(
      {
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      },
      {
        accountId: "acct_123",
        refreshUrl: "https://example.com/refresh",
        returnUrl: "https://example.com/return",
      },
    );
    assert.equal(params.type, "account_update");
    assert.equal(params.collection_options, undefined);
  });

  it("includes collection_options for account_onboarding links", () => {
    const params = stripeConnectAccountLinkCreateParams(
      {
        details_submitted: true,
        charges_enabled: false,
        payouts_enabled: false,
      },
      {
        accountId: "acct_123",
        refreshUrl: "https://example.com/refresh",
        returnUrl: "https://example.com/return",
      },
    );
    assert.equal(params.type, "account_onboarding");
    assert.equal(params.collection_options?.fields, "currently_due");
  });

  it("does not set business_type on update (locked after create)", () => {
    const params = stripeConnectAccountUpdateParams({
      shopId: "shop_1",
      shopSlug: "cool-shop",
      shopDisplayName: "Cool Shop",
      ownerEmail: "creator@example.com",
      appOrigin: "https://stillwet.com",
      country: "US",
    });
    assert.equal(params.business_type, undefined);
    assert.equal(params.business_profile?.url, "https://stillwet.com/s/cool-shop");
  });
});
