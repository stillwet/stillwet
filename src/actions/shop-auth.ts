"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import {
  BetaTesterOnboardingStatus,
  CreatorGiftCodeType,
  ShopReactivationPurchaseStatus,
  ShopSetupFeePurchaseStatus,
} from "@/generated/prisma/enums";
import {
  normalizeCreatorGiftCode,
  SHOP_SETUP_FEE_CENTS,
  SHOP_SETUP_FEE_LABEL,
} from "@/lib/creator-gift-codes";
import { isPurchasedShopSetupGiftCodeExpired } from "@/lib/creator-gift-code-expiration";
import { prisma } from "@/lib/prisma";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { getShopOwnerSession } from "@/lib/session";
import { hashShopPassword, verifyShopPassword } from "@/lib/shop-password";
import { findShopIdConflictingDisplayName } from "@/lib/shop-display-name-uniqueness.server";
import { SHOP_DISPLAY_NAME_TAKEN_ERROR } from "@/lib/shop-display-name-uniqueness";
import { allocateSignupShopSlug } from "@/lib/shop-slug";
import { BETA_TESTER_SIGNUP_LISTING_CREDITS } from "@/lib/beta-tester-codes";
import { applyBetaTesterSignupPerksInTransaction } from "@/lib/beta-tester-signup-perks";
import { issueShopEmailVerificationTokenAndSend } from "@/lib/shop-email-verification";
import { isShopLocalTwoFactorBypassEnabled } from "@/lib/shop-two-factor";
import { notifyShopFlairAccessGranted } from "@/lib/admin-award-promotion-notices";
import { listingFeeFreeSlotCap } from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { notifyShopFreeListingSlotsGranted } from "@/lib/shop-free-listing-grant-notice";
import { getStripe } from "@/lib/stripe";
import {
  buyerCheckoutTotalCents,
  stripeCheckoutPaymentProcessingLineItem,
} from "@/lib/stripe-card-processing-fee";
import {
  SHOP_REACTIVATION_FEE_CENTS,
  SHOP_REACTIVATION_FEE_LABEL,
  shopInactivityReactivationWindowExpired,
} from "@/lib/shop-inactivity-policy";

export type ShopAuthError = { error: string; redirectTo?: never } | { redirectTo: string; error?: never };

async function startReactivationCheckoutForUser(user: {
  id: string;
  email: string;
  shopId: string;
  shop: {
    displayName: string;
    accountDeletionRequestedAt: Date | null;
    inactivityDeletionTriggeredAt: Date | null;
    inactivityDeactivatedAt: Date | null;
  };
}): Promise<ShopAuthError> {
  if (user.shop.accountDeletionRequestedAt || user.shop.inactivityDeletionTriggeredAt) {
    return {
      error:
        "This shop has entered the account deletion process and cannot be reactivated from login. Contact support if you think this is a mistake.",
    };
  }
  if (shopInactivityReactivationWindowExpired(user.shop.inactivityDeactivatedAt)) {
    return {
      error:
        "The reactivation window for this shop has expired. Contact support if you need help with an abandoned or closed account.",
    };
  }
  const base = publicAppBaseUrl();
  if (!base) {
    return { error: "App URL is not configured. Set NEXT_PUBLIC_APP_URL before taking reactivation payments." };
  }
  const reactivationSubtotalCents = SHOP_REACTIVATION_FEE_CENTS;
  const checkoutTotalCents = buyerCheckoutTotalCents(reactivationSubtotalCents);
  const processingLine = stripeCheckoutPaymentProcessingLineItem({
    subtotalCents: reactivationSubtotalCents,
  });
  const purchase = await prisma.shopReactivationPurchase.create({
    data: {
      shopId: user.shopId,
      shopUserId: user.id,
      amountCents: checkoutTotalCents,
      currency: "usd",
      status: ShopReactivationPurchaseStatus.pending,
    },
    select: { id: true },
  });
  try {
    const appBase = base.replace(/\/$/, "");
    const checkout = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: SHOP_REACTIVATION_FEE_CENTS,
            product_data: {
              name: SHOP_REACTIVATION_FEE_LABEL,
              description: `One-time reactivation fee for ${user.shop.displayName}.`,
            },
          },
        },
        ...(processingLine ? [processingLine] : []),
      ],
      metadata: {
        kind: "shop_reactivation",
        purchaseId: purchase.id,
        shopId: user.shopId,
        shopUserId: user.id,
        subtotalCents: String(reactivationSubtotalCents),
        amountCents: String(checkoutTotalCents),
      },
      success_url: `${appBase}/dashboard/reactivate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/dashboard/login?reactivate=cancel`,
    });
    if (!checkout.url) {
      await prisma.shopReactivationPurchase.update({
        where: { id: purchase.id },
        data: { status: ShopReactivationPurchaseStatus.failed },
      });
      return { error: "Stripe did not return a reactivation checkout URL." };
    }
    await prisma.shopReactivationPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: checkout.id },
    });
    return { redirectTo: checkout.url };
  } catch (e) {
    console.error("[shop-auth] reactivation checkout failed", e);
    await prisma.shopReactivationPurchase.update({
      where: { id: purchase.id },
      data: { status: ShopReactivationPurchaseStatus.failed },
    });
    return { error: "Could not start reactivation payment. Try again." };
  }
}

export async function createShopFromSignup(
  _prev: ShopAuthError | undefined,
  formData: FormData,
): Promise<ShopAuthError | undefined> {
  const displayNameOpt = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const setupCodeRaw = String(formData.get("setupCode") ?? "").trim();
  const termsAccepted = formData.get("termsAccepted") === "yes";

  if (!termsAccepted) {
    return { error: "You must agree to the terms and conditions." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }
  if (password.length < 10) {
    return { error: "Password must be at least 10 characters." };
  }

  const displayName =
    displayNameOpt.length > 120 ? displayNameOpt.slice(0, 120) : displayNameOpt;

  if (displayName && (await findShopIdConflictingDisplayName(displayName))) {
    return { error: SHOP_DISPLAY_NAME_TAKEN_ERROR };
  }

  const slugResult = await allocateSignupShopSlug(displayName);
  if ("error" in slugResult) {
    return { error: slugResult.error };
  }
  const { slug } = slugResult;
  const emailTaken = await prisma.shopUser.findUnique({
    where: { email },
    include: { shop: { select: { inactivityDeactivatedAt: true } } },
  });
  if (emailTaken) {
    if (emailTaken.shop.inactivityDeactivatedAt) {
      return {
        error:
          "That email belongs to a deactivated shop. Sign in with the existing account to pay the $5 reactivation fee.",
      };
    }
    return { error: "That email is already registered." };
  }

  const passwordHash = hashShopPassword(password);
  if (setupCodeRaw) {
    const codeNormalized = normalizeCreatorGiftCode(setupCodeRaw);
    if (!codeNormalized) return { error: "Enter a valid setup fee gift code." };

    const created = await prisma.$transaction(async (tx) => {
      const giftCode = await tx.creatorGiftCode.findFirst({
        where: {
          codeNormalized,
          type: CreatorGiftCodeType.shop_setup,
          redeemedAt: null,
        },
        select: {
          id: true,
          createdAt: true,
          purchase: {
            select: {
              isBetaTesterBatch: true,
              isWaivedShopFeeBatch: true,
            },
          },
        },
      });
      if (!giftCode) return { status: "invalid_code" as const };
      if (
        !giftCode.purchase.isBetaTesterBatch &&
        !giftCode.purchase.isWaivedShopFeeBatch &&
        isPurchasedShopSetupGiftCodeExpired({ createdAt: giftCode.createdAt })
      ) {
        return { status: "expired_code" as const };
      }

      const emailConflict = await tx.shopUser.findUnique({
        where: { email },
        select: { id: true },
      });
      if (emailConflict) return { status: "email_taken" as const };

      const displayKey = displayName.trim().toLowerCase();
      if (displayKey) {
        const displayConflict = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM "Shop"
          WHERE LOWER(TRIM("displayName")) = ${displayKey}
          LIMIT 1
        `);
        if (displayConflict.length > 0) return { status: "display_taken" as const };
      }

      const consumed = await tx.creatorGiftCode.updateMany({
        where: { id: giftCode.id, redeemedAt: null },
        data: { redeemedAt: new Date() },
      });
      if (consumed.count === 0) return { status: "invalid_code" as const };

      const shop = await tx.shop.create({
        data: {
          slug,
          displayName,
          active: true,
          ...(giftCode.purchase.isBetaTesterBatch
            ? {
                betaTesterAt: new Date(),
                betaTesterOnboardingStatus: BetaTesterOnboardingStatus.in_progress,
              }
            : {}),
        },
        select: { id: true },
      });
      const user = await tx.shopUser.create({
        data: { email, passwordHash, shopId: shop.id, lastLoginAt: new Date() },
        select: { id: true, email: true },
      });
      await tx.creatorGiftCode.update({
        where: { id: giftCode.id },
        data: { redeemedByShopId: shop.id },
      });

      if (giftCode.purchase.isBetaTesterBatch) {
        await applyBetaTesterSignupPerksInTransaction(tx, {
          shopId: shop.id,
          shopUserId: user.id,
        });
      }

      return {
        status: "created" as const,
        shopUserId: user.id,
        email: user.email,
        shopId: shop.id,
        shopSlug: slug,
        isBetaTester: giftCode.purchase.isBetaTesterBatch,
      };
    });

    if (created.status === "invalid_code") {
      return { error: "That shop setup gift code is invalid or has already been used." };
    }
    if (created.status === "expired_code") {
      return { error: "That shop setup gift code has expired." };
    }
    if (created.status === "email_taken") {
      return { error: "That email is already registered." };
    }
    if (created.status === "display_taken") {
      return { error: SHOP_DISPLAY_NAME_TAKEN_ERROR };
    }

    const verifySend = await issueShopEmailVerificationTokenAndSend(
      created.shopUserId,
      created.email,
    );
    if (!verifySend.ok) {
      console.error("[create-shop] verification email failed:", verifySend.error);
    }

    if (created.isBetaTester) {
      await syncFreeListingFeeWaivers(created.shopId);
      const shopRow = await prisma.shop.findUnique({
        where: { id: created.shopId },
        select: { listingFeeBonusFreeSlots: true },
      });
      const totalBonus = shopRow?.listingFeeBonusFreeSlots ?? BETA_TESTER_SIGNUP_LISTING_CREDITS;
      await Promise.all([
        notifyShopFreeListingSlotsGranted({
          shopId: created.shopId,
          slotsGranted: BETA_TESTER_SIGNUP_LISTING_CREDITS,
          totalBonusSlots: totalBonus,
          totalFreeCap: listingFeeFreeSlotCap(created.shopSlug, totalBonus),
        }),
        notifyShopFlairAccessGranted({ shopId: created.shopId }),
      ]);
    }

    const session = await getShopOwnerSession();
    session.shopUserId = created.shopUserId;
    await session.save();
    redirect("/dashboard?shopWelcome=1");
  }

  const base = publicAppBaseUrl();
  if (!base) {
    return {
      error: "App URL is not configured. Set NEXT_PUBLIC_APP_URL before taking setup payments.",
    };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pending = await prisma.pendingShopSignup.create({
    data: {
      email,
      displayName,
      slug,
      passwordHash,
      expiresAt,
    },
    select: { id: true },
  });
  const setupSubtotalCents = SHOP_SETUP_FEE_CENTS;
  const checkoutTotalCents = buyerCheckoutTotalCents(setupSubtotalCents);
  const processingLine = stripeCheckoutPaymentProcessingLineItem({ subtotalCents: setupSubtotalCents });

  const purchase = await prisma.shopSetupFeePurchase.create({
    data: {
      pendingSignupId: pending.id,
      amountCents: checkoutTotalCents,
      currency: "usd",
      status: ShopSetupFeePurchaseStatus.pending,
    },
    select: { id: true },
  });

  try {
    const appBase = base.replace(/\/$/, "");
    const checkout = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: SHOP_SETUP_FEE_CENTS,
            product_data: {
              name: SHOP_SETUP_FEE_LABEL,
              description: "One-time account fee to open a creator shop.",
            },
          },
        },
        ...(processingLine ? [processingLine] : []),
      ],
      metadata: {
        kind: "shop_setup_fee",
        purchaseId: purchase.id,
        pendingSignupId: pending.id,
        email,
        subtotalCents: String(setupSubtotalCents),
        amountCents: String(checkoutTotalCents),
      },
      success_url: `${appBase}/create-shop/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/create-shop?setup=cancel`,
    });

    if (!checkout.url) {
      await prisma.shopSetupFeePurchase.update({
        where: { id: purchase.id },
        data: { status: ShopSetupFeePurchaseStatus.failed },
      });
      return { error: "Stripe did not return a checkout URL." };
    }

    await prisma.shopSetupFeePurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: checkout.id },
    });
    return { redirectTo: checkout.url };
  } catch (e) {
    console.error("[create-shop] setup fee checkout failed", e);
    await prisma.shopSetupFeePurchase.update({
      where: { id: purchase.id },
      data: { status: ShopSetupFeePurchaseStatus.failed },
    });
    return { error: "Could not start setup payment. Try again." };
  }
}

export async function loginShopOwner(
  _prev: ShopAuthError | undefined,
  formData: FormData,
): Promise<ShopAuthError | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await prisma.shopUser.findUnique({
    where: { email },
    include: {
      shop: {
        select: {
          id: true,
          displayName: true,
          accountDeletionRequestedAt: true,
          inactivityDeactivatedAt: true,
          inactivityDeletionTriggeredAt: true,
        },
      },
    },
  });
  if (!user || !verifyShopPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  if (user.shop.inactivityDeactivatedAt) {
    return startReactivationCheckoutForUser({
      id: user.id,
      email: user.email,
      shopId: user.shop.id,
      shop: {
        displayName: user.shop.displayName,
        accountDeletionRequestedAt: user.shop.accountDeletionRequestedAt,
        inactivityDeletionTriggeredAt: user.shop.inactivityDeletionTriggeredAt,
        inactivityDeactivatedAt: user.shop.inactivityDeactivatedAt,
      },
    });
  }

  if (user.twoFactorEmailEnabled && !isShopLocalTwoFactorBypassEnabled()) {
    const { bestEffortClientLabel, createTwoFactorChallenge, isTrustedDevice, readOrIssueDeviceId } =
      await import("@/lib/shop-two-factor");
    const deviceId = await readOrIssueDeviceId();
    const trusted = await isTrustedDevice(user.id, deviceId);
    if (!trusted) {
      const { sendShopTwoFactorConfirmEmail } = await import("@/lib/send-shop-two-factor-email");
      const challenge = await createTwoFactorChallenge(user.id, deviceId);
      const send = await sendShopTwoFactorConfirmEmail({
        toEmail: user.email,
        confirmUrl: challenge.confirmUrl,
        deviceLabel: await bestEffortClientLabel(),
        expiresAt: challenge.expiresAt,
      });
      if (!send.ok) {
        return { error: send.error };
      }
      const session = await getShopOwnerSession();
      session.pendingTwoFactorShopUserId = user.id;
      await session.save();
      redirect("/dashboard/confirm-device?sent=1");
    }
  } else if (user.twoFactorEmailEnabled && isShopLocalTwoFactorBypassEnabled()) {
    console.warn(
      "[shop-auth] SHOP_LOCAL_2FA_BYPASS: skipping email 2FA for this login (development only). Remove from env for real 2FA testing.",
    );
  }

  const session = await getShopOwnerSession();
  session.shopUserId = user.id;
  await prisma.shopUser.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      shop: { update: { inactivityWarningSentAt: null } },
    },
  });
  await session.save();
  redirect("/dashboard");
}

export async function logoutShopOwner() {
  const session = await getShopOwnerSession();
  session.destroy();
  redirect("/");
}
