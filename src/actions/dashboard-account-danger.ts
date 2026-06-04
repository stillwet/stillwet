"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { issueShopAccountDeletionTokenAndSend } from "@/lib/shop-account-deletion";
import { completeVerifiedShopAccountDeletion } from "@/lib/complete-verified-shop-account-deletion";
import {
  applyVerifiedAccountDeletionListingAndMediaCleanup,
  hideShopForPendingAccountDeletion,
  purgeShopUploadedMediaFromR2,
  restoreListingsAfterAccountDeletionRequestCancel,
} from "@/lib/shop-account-deletion-request-effects";
import { accountDeletionPendingInboxMessageForDev } from "@/lib/shop-account-deletion-copy";

async function requireShopOwnerRow() {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");
  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    include: { shop: true },
  });
  if (!user) {
    session.destroy();
    redirect("/dashboard/login");
  }
  if (user.shop.slug === PLATFORM_SHOP_SLUG) {
    return null;
  }
  return user;
}

export type AccountDangerResult = { ok: true; message?: string } | { ok: false; error: string };

function accountDeletionFreezeErrorMessage(e: unknown): string {
  if (e instanceof Error && /Unknown argument/i.test(e.message)) {
    return "The Prisma client was generated before a schema change. Stop `next dev`, run `npx prisma generate`, delete the `.next` folder if needed, then start dev again.";
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2022" || e.code === "P2021") {
      return "We could not update your shop because the database is missing a recent change. From the repo root on the machine that uses this database, run: npx prisma migrate deploy — then try again.";
    }
    return `Could not save your deletion request (${e.code}). Check the database connection and that migrations are applied.`;
  }
  if (e instanceof Error && e.message && process.env.NODE_ENV !== "production") {
    return `Could not save your deletion request: ${e.message}`;
  }
  return "Could not save your deletion request. Try again in a moment or contact support.";
}

export async function dashboardRequestAccountDeletion(): Promise<AccountDangerResult> {
  const user = await requireShopOwnerRow();
  if (!user) return { ok: false, error: "Not available for this account." };

  if (user.shop.accountDeletionRequestedAt) {
    return { ok: false, error: "A deletion request is already in progress." };
  }

  const shopWasActiveBeforeRequest = user.shop.active;

  try {
    await hideShopForPendingAccountDeletion(user.shopId);
  } catch (e) {
    console.error("[dashboardRequestAccountDeletion] hide shop failed", e);
    return { ok: false, error: accountDeletionFreezeErrorMessage(e) };
  }

  const sent = await issueShopAccountDeletionTokenAndSend(user.id, user.email);
  if (!sent.ok) {
    try {
      await restoreListingsAfterAccountDeletionRequestCancel(user.shopId);
      await prisma.shop.update({
        where: { id: user.shopId },
        data: {
          accountDeletionRequestedAt: null,
          accountDeletionEmailConfirmedAt: null,
          active: shopWasActiveBeforeRequest,
        },
      });
    } catch (rollbackErr) {
      console.error("[dashboardRequestAccountDeletion] rollback after email send failed", rollbackErr);
    }
    revalidatePath("/dashboard");
    revalidatePath(`/s/${user.shop.slug}`);
    revalidatePath("/shops");
    return { ok: false, error: sent.error };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  revalidatePath("/shops");

  return { ok: true, message: accountDeletionPendingInboxMessageForDev() };
}

/** Send a fresh account-deletion confirmation email while a request is pending and email is not yet confirmed. */
export async function dashboardResendAccountDeletionConfirmationEmail(): Promise<AccountDangerResult> {
  const user = await requireShopOwnerRow();
  if (!user) return { ok: false, error: "Not available for this account." };

  if (!user.shop.accountDeletionRequestedAt) {
    return { ok: false, error: "There is no pending deletion request." };
  }
  if (user.shop.accountDeletionEmailConfirmedAt) {
    return { ok: false, error: "Deletion is already confirmed by email." };
  }

  const sent = await issueShopAccountDeletionTokenAndSend(user.id, user.email);
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: accountDeletionPendingInboxMessageForDev() };
}

/**
 * Development only: simulates the account-deletion confirmation email link when local mail is unavailable.
 * Sets `accountDeletionEmailConfirmedAt`, then runs the same R2 purge + listing cleanup as the real confirm route.
 */
export async function dashboardDevConfirmAccountDeletionEmail(): Promise<AccountDangerResult> {
  if (process.env.NODE_ENV !== "development") {
    return { ok: false, error: "Only available in development." };
  }
  const user = await requireShopOwnerRow();
  if (!user) return { ok: false, error: "Not available for this account." };

  if (!user.shop.accountDeletionRequestedAt) {
    return { ok: false, error: "Request account deletion first." };
  }
  if (user.shop.accountDeletionEmailConfirmedAt) {
    return { ok: false, error: "Deletion email is already marked confirmed." };
  }

  try {
    await prisma.shop.update({
      where: { id: user.shopId },
      data: { accountDeletionEmailConfirmedAt: new Date() },
    });
    await purgeShopUploadedMediaFromR2(user.shopId);
    await applyVerifiedAccountDeletionListingAndMediaCleanup(user.shopId);
  } catch (e) {
    console.error("[dashboardDevConfirmAccountDeletionEmail]", e);
    return { ok: false, error: accountDeletionFreezeErrorMessage(e) };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  revalidatePath("/shops");
  return {
    ok: true,
    message:
      "[Dev] Marked deletion email confirmed and ran the same cleanup as the real link. Continue with Stripe + permanent delete when ready.",
  };
}

export async function dashboardCancelAccountDeletionRequest(): Promise<AccountDangerResult> {
  const user = await requireShopOwnerRow();
  if (!user) return { ok: false, error: "Not available for this account." };

  if (!user.shop.accountDeletionRequestedAt) {
    return { ok: false, error: "There is no pending deletion request." };
  }

  const reopen = user.shop.accountDeletionEmailConfirmedAt == null;

  await restoreListingsAfterAccountDeletionRequestCancel(user.shopId);
  await prisma.shop.update({
    where: { id: user.shopId },
    data: {
      accountDeletionRequestedAt: null,
      accountDeletionEmailConfirmedAt: null,
      ...(reopen ? { active: true } : {}),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/s/${user.shop.slug}`);
  revalidatePath("/shops");
  return {
    ok: true,
    message:
      reopen
        ? "Deletion request cancelled. Your shop can appear on browse again. Listing photos removed from storage are not restored — re-upload if you need them."
        : "Deletion request cancelled.",
  };
}

/** Returns `ok: true` only when the shop row was deleted (caller should sign out + redirect). */
export async function dashboardTryCompleteAccountDeletion(): Promise<AccountDangerResult> {
  const user = await requireShopOwnerRow();
  if (!user) return { ok: false, error: "Not available for this account." };

  if (!user.shop.accountDeletionEmailConfirmedAt) {
    return { ok: false, error: "Confirm the deletion link in your email first." };
  }

  const completion = await completeVerifiedShopAccountDeletion(user.shopId);
  if (!completion.ok) {
    return { ok: false, error: completion.error };
  }
  if (!completion.deleted) {
    if (completion.reason === "stripe_balance") {
      const balance = completion.stripeConnectBalance;
      if (balance == null) {
        return {
          ok: false,
          error:
            "Could not read your Stripe Connect balance. Try again, or wait until payouts finish and retry.",
        };
      }
      const a = balance.availableCents;
      const p = balance.pendingCents;
      return {
        ok: false,
        error: `Stripe still shows funds (available $${(a / 100).toFixed(2)}, pending $${(p / 100).toFixed(
          2,
        )}). Wait for payouts to finish, then try again.`,
      };
    }
    return { ok: false, error: "Account deletion is not ready to finish yet." };
  }

  revalidatePath("/shops");
  revalidatePath(`/s/${completion.shopSlug}`);
  return { ok: true };
}
