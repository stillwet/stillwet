"use server";

import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { isSiteEmailTemplateKey } from "@/lib/site-email-template-keys";
import {
  GIFT_SETUP_CODE_PLACEHOLDER,
  SITE_EMAIL_ACTION_URL_PLACEHOLDER,
  SITE_EMAIL_CHANGED_AT_UTC_PLACEHOLDER,
  SITE_EMAIL_SECURITY_ALERT_MAILTO_BLOCK_PLACEHOLDER,
} from "@/lib/email-template-placeholders";
import {
  getSiteEmailTemplatesProdSyncAvailability,
  syncSiteEmailTemplatesToProduction,
  type SiteEmailTemplatesProdSyncAvailability,
  type SiteEmailTemplatesProdSyncResult,
} from "@/lib/site-email-templates-prod-sync";

export type { SiteEmailTemplatesProdSyncAvailability, SiteEmailTemplatesProdSyncResult };

export async function adminGetSiteEmailTemplatesProdSyncAvailability(): Promise<SiteEmailTemplatesProdSyncAvailability> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");
  return getSiteEmailTemplatesProdSyncAvailability();
}

export async function adminSyncSiteEmailTemplatesToProduction(): Promise<SiteEmailTemplatesProdSyncResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const result = await syncSiteEmailTemplatesToProduction();
  if (result.ok) {
    revalidateAdminViews();
  }
  return result;
}

const SUBJECT_MAX = 500;
const HTML_MAX = 200_000;

export type AdminSaveSiteEmailTemplateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function adminSaveSiteEmailTemplate(
  _prev: AdminSaveSiteEmailTemplateResult | undefined,
  formData: FormData,
): Promise<AdminSaveSiteEmailTemplateResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const keyRaw = String(formData.get("key") ?? "").trim();
  if (!isSiteEmailTemplateKey(keyRaw)) {
    return { ok: false, error: "Unknown template." };
  }

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");

  if (!subject) {
    return { ok: false, error: "Subject is required." };
  }
  if (subject.length > SUBJECT_MAX) {
    return { ok: false, error: "Subject is too long." };
  }

  if (!body.trim()) {
    return { ok: false, error: "HTML body is required." };
  }
  if (body.length > HTML_MAX) {
    return { ok: false, error: "HTML body is too long." };
  }
  if (
    keyRaw !== "gift_creator_redemption_codes" &&
    !body.includes(SITE_EMAIL_ACTION_URL_PLACEHOLDER)
  ) {
    return {
      ok: false,
      error:
        "HTML must include {{ACTION_URL}} wherever the signed action link should appear when sending.",
    };
  }
  if (
    keyRaw === "shop_dashboard_password_changed" &&
    !body.includes(SITE_EMAIL_CHANGED_AT_UTC_PLACEHOLDER)
  ) {
    return {
      ok: false,
      error: "Password-changed email HTML must include {{CHANGED_AT_UTC}}.",
    };
  }
  if (
    keyRaw === "shop_dashboard_password_changed" &&
    !body.includes(SITE_EMAIL_SECURITY_ALERT_MAILTO_BLOCK_PLACEHOLDER)
  ) {
    return {
      ok: false,
      error:
        "Password-changed email HTML must include {{SECURITY_ALERT_MAILTO_BLOCK}} (replaced at send time with optional alert mailto).",
    };
  }
  if (
    keyRaw === "gift_creator_redemption_codes" &&
    !body.includes(GIFT_SETUP_CODE_PLACEHOLDER)
  ) {
    return {
      ok: false,
      error: "Gift code email HTML must include {{SETUP_CODE}}.",
    };
  }
  await prisma.siteEmailTemplate.upsert({
    where: { key: keyRaw },
    create: { key: keyRaw, subject, htmlBody: body, textBody: null },
    update: { subject, htmlBody: body, textBody: null },
  });

  revalidateAdminViews();
  return { ok: true };
}

export async function adminResetSiteEmailTemplate(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const keyRaw = String(formData.get("key") ?? "").trim();
  if (!isSiteEmailTemplateKey(keyRaw)) return;

  await prisma.siteEmailTemplate.deleteMany({ where: { key: keyRaw } });
  revalidateAdminViews();
}
