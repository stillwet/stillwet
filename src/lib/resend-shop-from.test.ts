import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_MERCH_NAME, brandMerchEmailFrom } from "@/lib/site-brand";
import {
  RESEND_DEV_FALLBACK_FROM,
  isResendDomainNotVerifiedResponse,
  resolveShopTransactionalEmailFrom,
  shopFromApexFallback,
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

describe("shopFromApexFallback", () => {
  it("maps auto.stillwet.com to stillwet.com", () => {
    const from = `${BRAND_MERCH_NAME} <noreply@auto.stillwet.com>`;
    assert.equal(
      shopFromApexFallback(from),
      `${BRAND_MERCH_NAME} <noreply@stillwet.com>`,
    );
  });

  it("returns null for apex domains", () => {
    assert.equal(shopFromApexFallback(`${BRAND_MERCH_NAME} <noreply@stillwet.com>`), null);
  });
});

describe("isResendDomainNotVerifiedResponse", () => {
  it("matches Resend 403 domain errors", () => {
    assert.equal(
      isResendDomainNotVerifiedResponse(
        403,
        '{"message":"The auto.stillwet.com domain is not verified."}',
      ),
      true,
    );
    assert.equal(isResendDomainNotVerifiedResponse(500, "domain is not verified"), false);
  });
});
