import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SITE_EMAIL_LOGO_R2_OBJECT_KEY,
  siteEmailLogoOutboundUrl,
  siteEmailLogoR2PublicUrl,
} from "@/lib/site-email-logo-url";

describe("site-email-logo-url", () => {
  it("builds R2 public URL from R2_PUBLIC_BASE_URL", () => {
    const prev = process.env.R2_PUBLIC_BASE_URL;
    const prevOverride = process.env.SITE_EMAIL_LOGO_URL;
    delete process.env.SITE_EMAIL_LOGO_URL;
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.stillwet.com/";
    try {
      assert.equal(
        siteEmailLogoR2PublicUrl(),
        `https://cdn.stillwet.com/${SITE_EMAIL_LOGO_R2_OBJECT_KEY}`,
      );
      assert.equal(
        siteEmailLogoOutboundUrl("https://stillwet.com"),
        `https://cdn.stillwet.com/${SITE_EMAIL_LOGO_R2_OBJECT_KEY}`,
      );
    } finally {
      if (prev === undefined) delete process.env.R2_PUBLIC_BASE_URL;
      else process.env.R2_PUBLIC_BASE_URL = prev;
      if (prevOverride === undefined) delete process.env.SITE_EMAIL_LOGO_URL;
      else process.env.SITE_EMAIL_LOGO_URL = prevOverride;
    }
  });

  it("prefers SITE_EMAIL_LOGO_URL override", () => {
    const prev = process.env.SITE_EMAIL_LOGO_URL;
    process.env.SITE_EMAIL_LOGO_URL = "https://example.com/logo.png";
    try {
      assert.equal(siteEmailLogoOutboundUrl(), "https://example.com/logo.png");
    } finally {
      if (prev === undefined) delete process.env.SITE_EMAIL_LOGO_URL;
      else process.env.SITE_EMAIL_LOGO_URL = prev;
    }
  });
});
