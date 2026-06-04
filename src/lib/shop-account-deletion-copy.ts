/** Shown after requesting deletion or resending the confirmation email (before email is confirmed). */
export const ACCOUNT_DELETION_PENDING_INBOX_MESSAGE =
  "Check your inbox for the confirmation link (expires in 24 hours).\nYour shop is hidden from browse in the meantime.";

export function accountDeletionPendingInboxMessageForDev(): string {
  let message = ACCOUNT_DELETION_PENDING_INBOX_MESSAGE;
  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY?.trim()) {
    message +=
      " Local dev: RESEND_API_KEY is not set, so no email was sent. In the terminal running `next dev`, find the line starting with `[shop-account-deletion]` for the confirmation URL, or use “Dev: confirm deletion email” in this panel.";
  }
  return message;
}
