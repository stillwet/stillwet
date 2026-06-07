/** Synthetic Resend ids for platform-generated inbox rows (not from Resend webhooks). */
export const ADMIN_INBOX_PLATFORM_RESEND_ID_PREFIX = "platform:";

export function isPlatformAdminInboxNotice(resendEmailId: string): boolean {
  return resendEmailId.startsWith(ADMIN_INBOX_PLATFORM_RESEND_ID_PREFIX);
}
