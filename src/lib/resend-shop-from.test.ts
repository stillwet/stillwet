import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_MERCH_NAME, brandMerchEmailFrom } from "@/lib/site-brand";
import {
  RESEND_DEV_FALLBACK_FROM,
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
  it("rejects yourdomain.com placeholder in production", () => {
    withNodeEnv("production", () => {
      const r = resolveShopTransactionalEmailFrom([
        `${BRAND_MERCH_NAME} <noreply@yourdomain.com>`,
      ]);
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.match(r.error, /SHOP_PASSWORD_RESET_EMAIL_FROM/);
      }
    });
  });

  it("skips yourdomain.com placeholder in development", () => {
    withNodeEnv("development", () => {
      const r = resolveShopTransactionalEmailFrom([
        `${BRAND_MERCH_NAME} <noreply@yourdomain.com>`,
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
});
