import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { adminInboxEmailAddress } from "@/lib/admin-inbox-config";
import { ADMIN_INBOX_PLATFORM_RESEND_ID_PREFIX } from "@/lib/admin-inbox-system-notice-shared";
import { prismaAdminInboundEmailOrNull } from "@/lib/prisma";
import { BRAND_NAME, SITE_CONTACT_EMAIL } from "@/lib/site-brand";

export { ADMIN_INBOX_PLATFORM_RESEND_ID_PREFIX, isPlatformAdminInboxNotice } from "@/lib/admin-inbox-system-notice-shared";

const PLATFORM_INBOX_FROM = `${BRAND_NAME} (automated) <${SITE_CONTACT_EMAIL}>`;

/**
 * Inserts a row into {@link AdminInboundEmail} so it appears on the admin Inbox tab.
 * No-op when the inbound delegate is unavailable (stale Prisma singleton).
 */
export async function recordAdminInboxSystemNotice(params: {
  /** Unique suffix after `platform:` (becomes `resendEmailId`). */
  resendEmailIdSuffix: string;
  subject: string;
  textBody: string;
  receivedAt?: Date;
}): Promise<void> {
  const inbound = prismaAdminInboundEmailOrNull();
  if (!inbound) return;

  const resendEmailId = `${ADMIN_INBOX_PLATFORM_RESEND_ID_PREFIX}${params.resendEmailIdSuffix}`;
  const receivedAt = params.receivedAt ?? new Date();

  try {
    await inbound.create({
      data: {
        resendEmailId,
        fromAddress: PLATFORM_INBOX_FROM,
        toAddress: adminInboxEmailAddress(),
        subject: params.subject,
        textBody: params.textBody,
        htmlBody: null,
        receivedAt,
      },
    });
    revalidateAdminViews();
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string"
        ? (e as { code: string }).code
        : "";
    if (code !== "P2002") {
      console.error("[recordAdminInboxSystemNotice] create failed", resendEmailId, e);
    }
  }
}
