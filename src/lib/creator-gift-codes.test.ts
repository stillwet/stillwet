import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCreatorGiftCode,
  generateCreatorGiftCode,
  normalizeCreatorGiftCode,
  SHOP_SETUP_FEE_CENTS,
} from "@/lib/creator-gift-codes";
import { renderGiftRedemptionCodeEmailHtml } from "@/lib/gift-redemption-code-email-html";

describe("creator gift codes", () => {
  it("normalizes codes case-insensitively and without separators", () => {
    assert.equal(normalizeCreatorGiftCode(" setu-pabc 1234-demo "), "SETUPABC1234DEMO");
    assert.equal(formatCreatorGiftCode("SETUPABC1234DEMO"), "SETU-PABC-1234-DEMO");
  });

  it("generates separate prefixed codes", () => {
    const setup = generateCreatorGiftCode("SETUP");
    const listing = generateCreatorGiftCode("LIST");
    assert.match(setup.codeNormalized, /^SETUP[A-Z0-9]+$/);
    assert.match(listing.codeNormalized, /^LIST[A-Z0-9]+$/);
    assert.notEqual(setup.codeNormalized, listing.codeNormalized);
  });

  it("keeps setup fee at fifteen dollars", () => {
    assert.equal(SHOP_SETUP_FEE_CENTS, 1500);
  });
});

describe("gift redemption code email", () => {
  it("renders gift placeholders", () => {
    const html = renderGiftRedemptionCodeEmailHtml(
      "<p>{{SETUP_CODE}}</p><p>{{LISTING_CODE}}</p><p>{{LISTING_CREDITS}}</p><p>{{PROMOTION_CODE}}</p><p>{{GOOGLE_SHOPPING_CODE}}</p>",
      {
        setupCode: "SETU-PABC-1234-DEMO",
        listingCode: "LIST-PXYZ-9876-DEMO",
        listingCredits: "10",
        promotionCode: "PROM-PDEM-0001-O123",
        promotionKindLabel: "Hot item",
        promotionCredits: "1",
        googleShoppingCode: "GMC-PGMC-0005-DEMO",
        googleShoppingCredits: "5",
      },
    );
    assert.match(html, /SETU-PABC-1234-DEMO/);
    assert.match(html, /LIST-PXYZ-9876-DEMO/);
    assert.match(html, />10</);
    assert.match(html, /PROM-PDEM-0001-O123/);
    assert.match(html, /GMC-PGMC-0005-DEMO/);
  });
});
