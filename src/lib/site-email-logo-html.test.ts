import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_LOGO_MARK } from "@/lib/site-brand";
import {
  SITE_EMAIL_LOGO_PLACEHOLDER,
  applySiteEmailLogoToHtml,
  normalizeEmailLogoForAdminPreview,
  siteEmailLogoAbsoluteUrl,
  siteEmailLogoDataUriForAdminPreview,
} from "@/lib/site-email-logo-html";

describe("site-email-logo-html", () => {
  it("builds an absolute logo URL from origin", () => {
    assert.equal(
      siteEmailLogoAbsoluteUrl("https://stillwet.com"),
      "https://stillwet.com/still-wet-logo-2048.png",
    );
  });

  it("replaces {{EMAIL_LOGO}} with logo and STILL WET wordmark for outbound mail", () => {
    const html = `<table><tr><td>${SITE_EMAIL_LOGO_PLACEHOLDER}<p>Hi</p></td></tr></table>`;
    const out = applySiteEmailLogoToHtml(html, { origin: "https://stillwet.com" });
    assert.ok(!out.includes(SITE_EMAIL_LOGO_PLACEHOLDER));
    assert.ok(out.includes('src="https://stillwet.com/still-wet-logo-2048.png"'));
    assert.ok(out.includes(BRAND_LOGO_MARK));
    assert.ok(out.includes("letter-spacing:0.2em"));
  });

  it("uses an inline data URI for admin preview", () => {
    const html = `<table><tr><td>${SITE_EMAIL_LOGO_PLACEHOLDER}<p>Hi</p></td></tr></table>`;
    const out = normalizeEmailLogoForAdminPreview(html);
    const dataUri = siteEmailLogoDataUriForAdminPreview();
    assert.ok(dataUri.startsWith("data:image/png;base64,"));
    assert.ok(out.includes(`src="${dataUri}"`));
    assert.ok(out.includes(BRAND_LOGO_MARK));
  });

  it("rewrites absolute logo URLs for admin preview without duplicating", () => {
    const html = applySiteEmailLogoToHtml(
      `<table><tr><td>${SITE_EMAIL_LOGO_PLACEHOLDER}<p>Hi</p></td></tr></table>`,
      { origin: "https://stillwet.com" },
    );
    const out = normalizeEmailLogoForAdminPreview(html);
    assert.equal((out.match(/<img[^>]+alt="Still Wet Merch"/g) ?? []).length, 1);
    assert.equal((out.match(new RegExp(BRAND_LOGO_MARK, "g")) ?? []).length, 1);
    assert.ok(out.includes('width="100%"'));
    assert.ok(out.includes("data:image/png;base64,"));
    assert.ok(!out.includes("https://stillwet.com/still-wet-logo-2048.png"));
    assert.ok(out.indexOf(BRAND_LOGO_MARK) < out.indexOf("<p>Hi</p>"));
  });

  it("auto-injects at inner card when placeholder is missing", () => {
    const html = `<table><tr><td align="center"><table role="presentation" width="100%" style="max-width:520px;background:#18181b;"><tr><td><p>inner</p></td></tr></table></td></tr></table>`;
    const out = applySiteEmailLogoToHtml(html, { origin: "https://stillwet.com" });
    assert.ok(out.includes("still-wet-logo-2048.png"));
    assert.ok(out.includes(BRAND_LOGO_MARK));
    assert.ok(out.indexOf("still-wet-logo-2048.png") < out.indexOf("<p>inner</p>"));
  });

  it("upgrades legacy logo-only header to logo + wordmark", () => {
    const legacy = `<p style="margin:0 0 16px;text-align:center;line-height:0;">
  <img src="https://stillwet.com/still-wet-logo-2048.png" alt="Still Wet Merch" width="48" height="48" style="display:inline-block;width:48px;height:48px;border:0;" />
</p><p>Body</p>`;
    const out = applySiteEmailLogoToHtml(legacy, { origin: "https://stillwet.com" });
    assert.ok(out.includes(BRAND_LOGO_MARK));
    assert.ok(!legacy.includes(BRAND_LOGO_MARK));
    assert.ok(!out.includes('text-align:center;line-height:0'));
  });
});
