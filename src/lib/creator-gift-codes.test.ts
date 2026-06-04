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
  it("renders setup code placeholder", () => {
    const html = renderGiftRedemptionCodeEmailHtml("<p>{{SETUP_CODE}}</p>", {
      setupCode: "SETU-PABC-1234-DEMO",
    });
    assert.match(html, /SETU-PABC-1234-DEMO/);
  });
});
