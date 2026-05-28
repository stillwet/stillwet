"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";
import { hashShopPassword, verifyShopPassword } from "@/lib/shop-password";
import { issueShopEmailVerificationTokenAndSend } from "@/lib/shop-email-verification";
import {
  sendShopEmailChangedNotificationToNewEmail,
  sendShopEmailChangedNotificationToPreviousEmail,
  sendShopPasswordChangedNotificationEmail,
} from "@/lib/send-shop-account-change-notification-email";

export type DashboardShopAccountResult =
  | { error: string }
  | { ok: true; message: string };

export async function updateShopOwnerTwoFactorEmailEnabled(
  _prev: DashboardShopAccountResult | undefined,
  formData: FormData,
): Promise<DashboardShopAccountResult> {
  const session = await getShopOwnerSessionReadonly();
  if (!session.shopUserId) {
    return { error: "Not signed in." };
  }

  const enabledRaw = formData.get("enabled");
  const enabled = enabledRaw === "on" || enabledRaw === "true" || enabledRaw === "1";

  await prisma.shopUser.update({
    where: { id: session.shopUserId },
    data: { twoFactorEmailEnabled: enabled },
  });

  revalidatePath("/dashboard");
  return { ok: true, message: enabled ? "Two-factor enabled." : "Two-factor disabled." };
}

export async function updateShopOwnerEmail(
  _prev: DashboardShopAccountResult | undefined,
  formData: FormData,
): Promise<DashboardShopAccountResult> {
  const session = await getShopOwnerSessionReadonly();
  if (!session.shopUserId) {
    return { error: "Not signed in." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newEmail = String(formData.get("newEmail") ?? "").trim().toLowerCase();

  if (!currentPassword) {
    return { error: "Enter your current password to change email." };
  }
  if (!newEmail || !newEmail.includes("@")) {
    return { error: "Enter a valid new email address." };
  }

  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user || !verifyShopPassword(currentPassword, user.passwordHash)) {
    return { error: "Current password is incorrect." };
  }

  if (newEmail === user.email.toLowerCase()) {
    return { error: "That is already your sign-in email." };
  }

  const taken = await prisma.shopUser.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (taken) {
    return { error: "That email is already registered to another account." };
  }

  const previousEmail = user.email;

  await prisma.shopUser.update({
    where: { id: user.id },
    data: {
      email: newEmail,
      emailVerifiedAt: null,
    },
  });

  const notifyPrev = await sendShopEmailChangedNotificationToPreviousEmail({
    previousEmail,
    newEmail,
  });
  if (!notifyPrev.ok) {
    console.error("[dashboard-shop-account] security email to previous address failed:", notifyPrev.error);
  }
  const notifyNew = await sendShopEmailChangedNotificationToNewEmail({
    newEmail,
    previousEmail,
  });
  if (!notifyNew.ok) {
    console.error("[dashboard-shop-account] security email to new address failed:", notifyNew.error);
  }

  const verifySend = await issueShopEmailVerificationTokenAndSend(user.id, newEmail);
  if (!verifySend.ok) {
    return {
      error:
        "Email was updated but we could not send the verification message. Use “Resend verification” on the Onboarding tab, or contact support.",
    };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message:
      "Sign-in email updated. We sent a verification link to the new address — confirm it to restore the verified badge on onboarding.",
  };
}

export async function updateShopOwnerPassword(
  _prev: DashboardShopAccountResult | undefined,
  formData: FormData,
): Promise<DashboardShopAccountResult> {
  const session = await getShopOwnerSessionReadonly();
  if (!session.shopUserId) {
    return { error: "Not signed in." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password." };
  }
  if (newPassword.length < 10) {
    return { error: "New password must be at least 10 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user || !verifyShopPassword(currentPassword, user.passwordHash)) {
    return { error: "Current password is incorrect." };
  }

  await prisma.shopUser.update({
    where: { id: user.id },
    data: { passwordHash: hashShopPassword(newPassword) },
  });

  const notify = await sendShopPasswordChangedNotificationEmail(user.email);
  if (!notify.ok) {
    console.error("[dashboard-shop-account] password-changed notification email failed:", notify.error);
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Password updated. Use it the next time you sign in." };
}
