import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandMerchEmailFrom } from "@/lib/site-brand";
import {
  RESEND_DEV_FALLBACK_FROM,
  resolveShopAutomatedTransactionalEmailFrom,
  resolveShopTransactionalEmailFrom,
} from "@/lib/resend-shop-from";

function withNodeEnv<T>(nodeEnv: "development" | "production" | "test", fn: () => T): T {
  const env = process.env as NodeJS.ProcessEnv & { NODE_ENV?: string };
  const prev = env.NODE_ENV;
  env.NODE_ENV = nodeEnv;
  try {
    return fn();
  } finally {
    env.NODE_ENV = prev;
  }
}

describe("resolveShopTransactionalEmailFrom", () => {
  it("falls back to info@stillwet.com when only placeholder is configured", () => {
    const fallback = brandMerchEmailFrom();
    withNodeEnv("production", () => {
      const r = resolveShopTransactionalEmailFrom([
        "Still Wet Merch <noreply@yourdomain.com>",
      ]);
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.from, fallback);
      }
    });
  });

  it("skips yourdomain.com placeholder in development", () => {
    withNodeEnv("development", () => {
      const r = resolveShopTransactionalEmailFrom([
        "Still Wet Merch <noreply@yourdomain.com>",
      ]);
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.from, RESEND_DEV_FALLBACK_FROM);
      }
    });
  });

  it("uses verified from when configured", () => {
    const verified = brandMerchEmailFrom();
    const r = resolveShopTransactionalEmailFrom([verified]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.from, verified);
    }
  });

  it("skips retired auto.stillwet.com and falls back to info@stillwet.com", () => {
    const fallback = brandMerchEmailFrom();
    const r = resolveShopTransactionalEmailFrom([
      "Still Wet Merch <noreply@auto.stillwet.com>",
      "Still Wet Merch <noreply@auto.stillwet.com>",
    ]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.from, fallback);
    }
  });

  it("prefers SHOP_PASSWORD_RESET over CONTACT_QUOTE for automated mail", () => {
    const prevReset = process.env.SHOP_PASSWORD_RESET_EMAIL_FROM;
    const prevQuote = process.env.CONTACT_QUOTE_FROM_EMAIL;
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM = "Still Wet Merch <info@stillwet.com>";
    process.env.CONTACT_QUOTE_FROM_EMAIL = "Still Wet Merch <noreply@auto.stillwet.com>";
    try {
      const r = resolveShopAutomatedTransactionalEmailFrom();
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.from, "Still Wet Merch <info@stillwet.com>");
      }
    } finally {
      if (prevReset === undefined) delete process.env.SHOP_PASSWORD_RESET_EMAIL_FROM;
      else process.env.SHOP_PASSWORD_RESET_EMAIL_FROM = prevReset;
      if (prevQuote === undefined) delete process.env.CONTACT_QUOTE_FROM_EMAIL;
      else process.env.CONTACT_QUOTE_FROM_EMAIL = prevQuote;
    }
  });
});
