import type Stripe from "stripe";
import { emailLinkOrigin } from "@/lib/public-app-url";

/** Men's and Women's Clothing and Accessories Stores — Stripe MCC for apparel retail. */
export const STRIPE_CONNECT_CLOTHING_ACCESSORIES_MCC = "5691";

const CLOTHING_PRODUCT_DESCRIPTION =
  "Clothing and accessories merchandise sold through an online storefront.";

/** Public creator shop homepage (`/s/{slug}`) — Stripe `business_profile.url` / business website. */
export function creatorShopPublicUrl(appOrigin: string, shopSlug: string): string {
  const base = appOrigin.replace(/\/$/, "");
  const slug = shopSlug.trim();
  return `${base}/s/${encodeURIComponent(slug)}`;
}

/**
 * Origin used for `business_profile.url` (shop homepage).
 * Override with `STRIPE_CONNECT_WEBSITE_ORIGIN` when testing Connect locally — Stripe rejects localhost.
 */
export function resolveStripeConnectWebsiteOrigin(): string {
  const override = process.env.STRIPE_CONNECT_WEBSITE_ORIGIN?.trim().replace(/\/$/, "");
  if (override) return override;
  return emailLinkOrigin();
}

/** Stripe will not persist or prefill business websites on localhost / non-HTTPS origins. */
export function isStripePrefillableWebsiteOrigin(origin: string): boolean {
  try {
    let base = origin.trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(base)) {
      base = `https://${base}`;
    }
    const u = new URL(base);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      return false;
    }
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export type StripeConnectAccountPrefillInput = {
  shopId: string;
  shopSlug: string;
  shopDisplayName: string;
  ownerEmail: string;
  appOrigin: string;
  country: string;
};

export function stripeConnectBusinessWebsiteUrl(
  input: StripeConnectAccountPrefillInput,
): string | undefined {
  if (!isStripePrefillableWebsiteOrigin(input.appOrigin)) {
    return undefined;
  }
  return creatorShopPublicUrl(input.appOrigin, input.shopSlug);
}

function prefillBusinessProfile(
  input: StripeConnectAccountPrefillInput,
): Stripe.AccountCreateParams.BusinessProfile {
  const name = input.shopDisplayName.trim() || input.shopSlug.trim();
  const email = input.ownerEmail.trim();
  const url = stripeConnectBusinessWebsiteUrl(input);
  return {
    ...(name ? { name } : {}),
    ...(url ? { url } : { product_description: CLOTHING_PRODUCT_DESCRIPTION }),
    mcc: STRIPE_CONNECT_CLOTHING_ACCESSORIES_MCC,
    ...(email ? { support_email: email } : {}),
  };
}

/** Params for `stripe.accounts.create` — prefilled fields are omitted from hosted onboarding when valid. */
export function stripeConnectAccountCreateParams(
  input: StripeConnectAccountPrefillInput,
): Stripe.AccountCreateParams {
  const email = input.ownerEmail.trim();
  return {
    type: "express",
    country: input.country,
    ...(email ? { email } : {}),
    business_type: "individual",
    business_profile: prefillBusinessProfile(input),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { shopId: input.shopId },
  };
}

/** Refresh prefill on existing Express accounts (omit locked fields like `business_type`). */
export function stripeConnectAccountUpdateParams(
  input: StripeConnectAccountPrefillInput,
): Stripe.AccountUpdateParams {
  const email = input.ownerEmail.trim();
  return {
    ...(email ? { email } : {}),
    business_profile: prefillBusinessProfile(input),
  };
}

/** Hosted link type — incomplete accounts must use onboarding, not account_update. */
export function stripeConnectAccountLinkType(
  account: Pick<Stripe.Account, "details_submitted" | "charges_enabled" | "payouts_enabled">,
): Stripe.AccountLinkCreateParams.Type {
  if (!account.charges_enabled || !account.payouts_enabled) {
    return "account_onboarding";
  }
  return account.details_submitted ? "account_update" : "account_onboarding";
}

export const stripeConnectAccountLinkCollectionOptions: Stripe.AccountLinkCreateParams.CollectionOptions =
  {
    fields: "currently_due",
    future_requirements: "omit",
  };

/** `collection_options` is only valid for `account_onboarding` (invalid with `account_update`). */
export function stripeConnectAccountLinkCreateParams(
  account: Pick<Stripe.Account, "details_submitted" | "charges_enabled" | "payouts_enabled">,
  urls: { accountId: string; refreshUrl: string; returnUrl: string },
): Stripe.AccountLinkCreateParams {
  const type = stripeConnectAccountLinkType(account);
  return {
    account: urls.accountId,
    refresh_url: urls.refreshUrl,
    return_url: urls.returnUrl,
    type,
    ...(type === "account_onboarding"
      ? { collection_options: stripeConnectAccountLinkCollectionOptions }
      : {}),
  };
}

export async function syncStripeConnectAccountPrefill(
  stripe: Stripe,
  accountId: string | null,
  input: StripeConnectAccountPrefillInput,
): Promise<{ accountId: string; account: Stripe.Account }> {
  if (!accountId) {
    const account = await stripe.accounts.create(stripeConnectAccountCreateParams(input));
    logBusinessProfileUrlMismatch(account.id, input, account.business_profile?.url ?? null);
    return { accountId: account.id, account };
  }

  try {
    await stripe.accounts.update(accountId, stripeConnectAccountUpdateParams(input));
  } catch (e) {
    console.error("[stripe-connect-prefill] account update failed, retrying business_profile only", e);
    try {
      await stripe.accounts.update(accountId, {
        business_profile: prefillBusinessProfile(input),
      });
    } catch (retryErr) {
      console.error("[stripe-connect-prefill] business_profile-only update failed", retryErr);
    }
  }

  const account = await stripe.accounts.retrieve(accountId);
  logBusinessProfileUrlMismatch(accountId, input, account.business_profile?.url ?? null);
  return { accountId, account };
}

function logBusinessProfileUrlMismatch(
  accountId: string,
  input: StripeConnectAccountPrefillInput,
  actualUrl: string | null,
): void {
  const expected = stripeConnectBusinessWebsiteUrl(input);
  if (!expected) {
    if (!isStripePrefillableWebsiteOrigin(input.appOrigin)) {
      console.warn(
        "[stripe-connect-prefill] business website not sent — use a public HTTPS origin (set STRIPE_CONNECT_WEBSITE_ORIGIN when developing on localhost)",
        { accountId, appOrigin: input.appOrigin },
      );
    }
    return;
  }
  if (actualUrl !== expected) {
    console.warn("[stripe-connect-prefill] business_profile.url mismatch after sync", {
      accountId,
      expected,
      actual: actualUrl,
    });
  }
}
