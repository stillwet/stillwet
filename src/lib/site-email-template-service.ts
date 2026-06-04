import { prisma } from "@/lib/prisma";
import {
  SHOP_ACCOUNT_DELETION_HTML_TEMPLATE,
  SHOP_ACCOUNT_DELETION_SUBJECT,
  renderShopAccountDeletionConfirmHtml,
} from "@/lib/shop-account-deletion-email-html";
import {
  SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE,
  SHOP_EMAIL_VERIFICATION_SUBJECT,
  renderShopEmailVerificationHtml,
} from "@/lib/shop-email-verification-email-html";
import {
  SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
  SHOP_PASSWORD_RESET_HTML_TEMPLATE,
  renderShopPasswordResetEmailHtml,
} from "@/lib/shop-password-reset-email-html";
import {
  SHOP_TWO_FACTOR_CONFIRM_DEVICE_HTML_TEMPLATE,
  SHOP_TWO_FACTOR_CONFIRM_DEVICE_SUBJECT,
  renderShopTwoFactorConfirmDeviceHtml,
} from "@/lib/shop-two-factor-confirm-device-email-html";
import type { GiftRedemptionEmailVars } from "@/lib/email-template-placeholders";
import {
  GIFT_REDEMPTION_CODE_EMAIL_SUBJECT,
  GIFT_REDEMPTION_CODE_HTML_TEMPLATE,
  renderGiftRedemptionCodeEmailHtml,
} from "@/lib/gift-redemption-code-email-html";
import {
  SHOP_INACTIVITY_WARNING_EMAIL_SUBJECT,
  SHOP_INACTIVITY_WARNING_HTML_TEMPLATE,
  renderShopInactivityWarningHtml,
} from "@/lib/shop-inactivity-warning-email-html";
import {
  SHOP_PASSWORD_CHANGED_EMAIL_SUBJECT,
  SHOP_PASSWORD_CHANGED_HTML_TEMPLATE,
  renderShopPasswordChangedEmailHtml,
  shopDashboardSupportUrl,
} from "@/lib/shop-password-changed-email-html";
import type { SiteEmailTemplateKey } from "@/lib/site-email-template-keys";
import { applySiteEmailLogoToHtml, normalizeEmailLogoForAdminPreview } from "@/lib/site-email-logo-html";

export type AdminEmailFormatEntry = {
  key: SiteEmailTemplateKey;
  label: string;
  description: string;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  sampleActionUrl: string | null;
};

export function sampleActionUrlsForAdmin(origin: string): Record<
  | "shop_dashboard_email_verification"
  | "shop_dashboard_password_reset"
  | "shop_dashboard_password_changed"
  | "shop_dashboard_account_deletion_confirm"
  | "shop_dashboard_two_factor_confirm_device"
  | "shop_inactivity_deactivation_warning",
  string
> {
  const o = origin.replace(/\/$/, "");
  return {
    shop_dashboard_email_verification: `${o}/dashboard/verify-email?t=__preview__`,
    shop_dashboard_password_reset: `${o}/dashboard/reset-password?t=__preview__`,
    shop_dashboard_password_changed: shopDashboardSupportUrl(o),
    shop_dashboard_account_deletion_confirm: `${o}/dashboard/account-deletion/confirm?t=__preview__`,
    shop_dashboard_two_factor_confirm_device: `${o}/dashboard/confirm-device?t=__preview__`,
    shop_inactivity_deactivation_warning: `${o}/dashboard/login`,
  };
}

export function buildAdminEmailFormatEntries(
  rows: { key: string; subject: string | null; htmlBody: string | null; textBody: string | null }[],
  origin: string,
): AdminEmailFormatEntry[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const actionSamples = sampleActionUrlsForAdmin(origin);

  const pick = (key: SiteEmailTemplateKey) => byKey.get(key);

  const verification = pick("shop_dashboard_email_verification");
  const password = pick("shop_dashboard_password_reset");
  const passwordChanged = pick("shop_dashboard_password_changed");
  const deletion = pick("shop_dashboard_account_deletion_confirm");
  const confirmDevice = pick("shop_dashboard_two_factor_confirm_device");
  const giftCodes = pick("gift_creator_redemption_codes");
  const inactivityWarning = pick("shop_inactivity_deactivation_warning");
  return [
    {
      key: "shop_dashboard_email_verification",
      label: "Shop dashboard — verify email",
      description:
        "Sent when a creator signs up or changes dashboard email. Full HTML document; use {{ACTION_URL}} for the verification button link.",
      defaultSubject: SHOP_EMAIL_VERIFICATION_SUBJECT,
      defaultBody: SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE,
      subject: verification?.subject?.trim() || SHOP_EMAIL_VERIFICATION_SUBJECT,
      body: verification?.htmlBody?.trim() || SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_email_verification,
    },
    {
      key: "shop_dashboard_password_reset",
      label: "Shop dashboard — password reset",
      description:
        "Sent from forgot-password flow. Full HTML document; use {{ACTION_URL}} for the reset button link (expires in 2 hours).",
      defaultSubject: SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
      defaultBody: SHOP_PASSWORD_RESET_HTML_TEMPLATE,
      subject: password?.subject?.trim() || SHOP_PASSWORD_RESET_EMAIL_SUBJECT,
      body: password?.htmlBody?.trim() || SHOP_PASSWORD_RESET_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_password_reset,
    },
    {
      key: "shop_dashboard_password_changed",
      label: "Shop dashboard — password changed",
      description:
        "Security notice after the dashboard password is changed. Full HTML document; use {{CHANGED_AT_UTC}} for the timestamp and {{ACTION_URL}} for the support dashboard link.",
      defaultSubject: SHOP_PASSWORD_CHANGED_EMAIL_SUBJECT,
      defaultBody: SHOP_PASSWORD_CHANGED_HTML_TEMPLATE,
      subject: passwordChanged?.subject?.trim() || SHOP_PASSWORD_CHANGED_EMAIL_SUBJECT,
      body: passwordChanged?.htmlBody?.trim() || SHOP_PASSWORD_CHANGED_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_password_changed,
    },
    {
      key: "shop_dashboard_account_deletion_confirm",
      label: "Shop dashboard — confirm account deletion",
      description:
        "Sent when a shop requests account deletion. Full HTML document; use {{ACTION_URL}} for the confirmation button link.",
      defaultSubject: SHOP_ACCOUNT_DELETION_SUBJECT,
      defaultBody: SHOP_ACCOUNT_DELETION_HTML_TEMPLATE,
      subject: deletion?.subject?.trim() || SHOP_ACCOUNT_DELETION_SUBJECT,
      body: deletion?.htmlBody?.trim() || SHOP_ACCOUNT_DELETION_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_account_deletion_confirm,
    },
    {
      key: "shop_dashboard_two_factor_confirm_device",
      label: "Shop dashboard — confirm sign-in (2FA)",
      description:
        "Sent when two-factor is enabled and a creator signs in from a new device. Full HTML document; use {{ACTION_URL}} for the confirmation button link.",
      defaultSubject: SHOP_TWO_FACTOR_CONFIRM_DEVICE_SUBJECT,
      defaultBody: SHOP_TWO_FACTOR_CONFIRM_DEVICE_HTML_TEMPLATE,
      subject: confirmDevice?.subject?.trim() || SHOP_TWO_FACTOR_CONFIRM_DEVICE_SUBJECT,
      body: confirmDevice?.htmlBody?.trim() || SHOP_TWO_FACTOR_CONFIRM_DEVICE_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_dashboard_two_factor_confirm_device,
    },
    {
      key: "gift_creator_redemption_codes",
      label: "Gift a creator — shop setup code",
      description:
        "Sent after a shop setup fee gift checkout. Full HTML document; use {{SETUP_CODE}} for the redemption code.",
      defaultSubject: GIFT_REDEMPTION_CODE_EMAIL_SUBJECT,
      defaultBody: GIFT_REDEMPTION_CODE_HTML_TEMPLATE,
      subject: giftCodes?.subject?.trim() || GIFT_REDEMPTION_CODE_EMAIL_SUBJECT,
      body: giftCodes?.htmlBody?.trim() || GIFT_REDEMPTION_CODE_HTML_TEMPLATE,
      sampleActionUrl: null,
    },
    {
      key: "shop_inactivity_deactivation_warning",
      label: "Shop dashboard — inactivity warning",
      description:
        "Sent when a creator has not logged in for 60 days. Full HTML document; use {{ACTION_URL}} for the dashboard login link.",
      defaultSubject: SHOP_INACTIVITY_WARNING_EMAIL_SUBJECT,
      defaultBody: SHOP_INACTIVITY_WARNING_HTML_TEMPLATE,
      subject: inactivityWarning?.subject?.trim() || SHOP_INACTIVITY_WARNING_EMAIL_SUBJECT,
      body: inactivityWarning?.htmlBody?.trim() || SHOP_INACTIVITY_WARNING_HTML_TEMPLATE,
      sampleActionUrl: actionSamples.shop_inactivity_deactivation_warning,
    },
  ];
}

export type SiteEmailSendPreview = {
  subject: string;
  html: string;
};

/** Same HTML/subject as Resend receives — uses saved `SiteEmailTemplate` rows (not the admin textarea). */
export async function loadSiteEmailSendPreviewsForAdmin(
  origin: string,
): Promise<Record<SiteEmailTemplateKey, SiteEmailSendPreview>> {
  const samples = sampleActionUrlsForAdmin(origin);
  const [verification, password, passwordChanged, deletion, twoFactor, giftCodes, inactivityWarning] =
    await Promise.all([
    resolveShopEmailVerificationEmail(samples.shop_dashboard_email_verification),
    resolveShopPasswordResetEmail(samples.shop_dashboard_password_reset),
    resolveShopPasswordChangedNotificationEmail({
      changedAtUtc: "Mon, 01 Jan 2024 12:00:00 GMT",
      supportUrl: samples.shop_dashboard_password_changed,
    }),
    resolveShopAccountDeletionConfirmEmail(samples.shop_dashboard_account_deletion_confirm),
    resolveShopTwoFactorConfirmDeviceEmail(samples.shop_dashboard_two_factor_confirm_device),
    resolveGiftRedemptionCodeEmail({
      setupCode: "SETU-PABC-1234-DEMO",
    }),
    resolveShopInactivityWarningEmail(samples.shop_inactivity_deactivation_warning),
  ]);
  return {
    shop_dashboard_email_verification: {
      ...verification,
      html: normalizeEmailLogoForAdminPreview(verification.html),
    },
    shop_dashboard_password_reset: {
      ...password,
      html: normalizeEmailLogoForAdminPreview(password.html),
    },
    shop_dashboard_password_changed: {
      ...passwordChanged,
      html: normalizeEmailLogoForAdminPreview(passwordChanged.html),
    },
    shop_dashboard_account_deletion_confirm: {
      ...deletion,
      html: normalizeEmailLogoForAdminPreview(deletion.html),
    },
    shop_dashboard_two_factor_confirm_device: {
      ...twoFactor,
      html: normalizeEmailLogoForAdminPreview(twoFactor.html),
    },
    gift_creator_redemption_codes: {
      ...giftCodes,
      html: normalizeEmailLogoForAdminPreview(giftCodes.html),
    },
    shop_inactivity_deactivation_warning: {
      ...inactivityWarning,
      html: normalizeEmailLogoForAdminPreview(inactivityWarning.html),
    },
  };
}

export async function resolveShopEmailVerificationEmail(verifyUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_email_verification" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_EMAIL_VERIFICATION_SUBJECT;
  return {
    subject,
    html: applySiteEmailLogoToHtml(renderShopEmailVerificationHtml(htmlTpl, verifyUrl)),
  };
}

export async function resolveShopPasswordResetEmail(resetUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_password_reset" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_PASSWORD_RESET_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_PASSWORD_RESET_EMAIL_SUBJECT;
  return {
    subject,
    html: applySiteEmailLogoToHtml(renderShopPasswordResetEmailHtml(htmlTpl, resetUrl)),
  };
}

export async function resolveShopPasswordChangedNotificationEmail(args: {
  changedAtUtc: string;
  supportUrl?: string;
}): Promise<{ subject: string; html: string }> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_password_changed" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_PASSWORD_CHANGED_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_PASSWORD_CHANGED_EMAIL_SUBJECT;
  const supportUrl = args.supportUrl ?? shopDashboardSupportUrl();
  return {
    subject,
    html: applySiteEmailLogoToHtml(
      renderShopPasswordChangedEmailHtml(htmlTpl, {
        changedAtUtc: args.changedAtUtc,
        supportUrl,
      }),
    ),
  };
}

export async function resolveShopAccountDeletionConfirmEmail(confirmUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_account_deletion_confirm" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_ACCOUNT_DELETION_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_ACCOUNT_DELETION_SUBJECT;
  return {
    subject,
    html: applySiteEmailLogoToHtml(renderShopAccountDeletionConfirmHtml(htmlTpl, confirmUrl)),
  };
}

export async function resolveShopTwoFactorConfirmDeviceEmail(confirmUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_dashboard_two_factor_confirm_device" },
  });
  const htmlTpl = row?.htmlBody?.trim()
    ? row.htmlBody
    : SHOP_TWO_FACTOR_CONFIRM_DEVICE_HTML_TEMPLATE;
  const subject = row?.subject?.trim()
    ? row.subject
    : SHOP_TWO_FACTOR_CONFIRM_DEVICE_SUBJECT;
  return {
    subject,
    html: applySiteEmailLogoToHtml(renderShopTwoFactorConfirmDeviceHtml(htmlTpl, confirmUrl)),
  };
}

export async function resolveGiftRedemptionCodeEmail(
  vars: GiftRedemptionEmailVars,
): Promise<{ subject: string; html: string }> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "gift_creator_redemption_codes" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : GIFT_REDEMPTION_CODE_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : GIFT_REDEMPTION_CODE_EMAIL_SUBJECT;
  return {
    subject,
    html: applySiteEmailLogoToHtml(renderGiftRedemptionCodeEmailHtml(htmlTpl, vars)),
  };
}

export async function resolveShopInactivityWarningEmail(loginUrl: string): Promise<{
  subject: string;
  html: string;
}> {
  const row = await prisma.siteEmailTemplate.findUnique({
    where: { key: "shop_inactivity_deactivation_warning" },
  });
  const htmlTpl = row?.htmlBody?.trim() ? row.htmlBody : SHOP_INACTIVITY_WARNING_HTML_TEMPLATE;
  const subject = row?.subject?.trim() ? row.subject : SHOP_INACTIVITY_WARNING_EMAIL_SUBJECT;
  return {
    subject,
    html: applySiteEmailLogoToHtml(renderShopInactivityWarningHtml(htmlTpl, loginUrl)),
  };
}

