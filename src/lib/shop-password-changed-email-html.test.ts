import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SITE_EMAIL_CHANGED_AT_UTC_PLACEHOLDER } from "@/lib/email-template-placeholders";
import {
  SHOP_PASSWORD_CHANGED_HTML_TEMPLATE,
  renderShopPasswordChangedEmailHtml,
} from "@/lib/shop-password-changed-email-html";

describe("shop-password-changed-email-html", () => {
  it("renders timestamp and support URL placeholders", () => {
    const html = renderShopPasswordChangedEmailHtml(SHOP_PASSWORD_CHANGED_HTML_TEMPLATE, {
      changedAtUtc: "Tue, 02 Jun 2026 12:00:00 GMT UTC",
      supportUrl: "https://stillwet.com/dashboard?dash=support",
    });
    assert.ok(!html.includes(SITE_EMAIL_CHANGED_AT_UTC_PLACEHOLDER));
    assert.ok(html.includes("Tue, 02 Jun 2026 12:00:00 GMT UTC"));
    assert.ok(html.includes("https://stillwet.com/dashboard?dash=support"));
    assert.ok(html.includes("Notify support (dashboard)"));
  });
});
