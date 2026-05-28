import { SITE_CONTACT_EMAIL } from "@/lib/site-brand";

/** Primary admin mailbox address (Resend inbound). Override with `ADMIN_INBOX_EMAIL`. */
export function adminInboxEmailAddress(): string {
  return (process.env.ADMIN_INBOX_EMAIL ?? SITE_CONTACT_EMAIL).trim().toLowerCase();
}
