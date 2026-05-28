import { emailLinkOrigin } from "@/lib/public-app-url";
import { dashQueryParamForTabId } from "@/lib/dashboard-dash-query";
import { resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";

type SendResult = { ok: true } | { ok: false; error: string };

function resendUserFacingError(status: number, body: string): string {
  let msg = "";
  try {
    const j = JSON.parse(body) as { message?: string };
    if (typeof j?.message === "string" && j.message.trim()) {
      msg = j.message.trim().slice(0, 280);
    }
  } catch {
    if (body.trim()) msg = body.trim().slice(0, 280);
  }
  if (msg) return `Email could not be sent (${status}): ${msg}`;
  return `Email could not be sent (HTTP ${status}).`;
}

function securityFooterHtml(): string {
  const origin = emailLinkOrigin();
  const supportTab = dashQueryParamForTabId("support");
  const dashboardSupportUrl = `${origin}/dashboard?dash=${encodeURIComponent(supportTab)}`;
  const alertMailbox = process.env.SHOP_SECURITY_ALERT_EMAIL?.trim();

  const mailtoHref = alertMailbox
    ? `mailto:${encodeURIComponent(alertMailbox)}?subject=${encodeURIComponent(
        "Security: I did not change my shop dashboard account",
      )}&body=${encodeURIComponent(
        "Please investigate unauthorized changes to my shop dashboard account.\n\n",
      )}`
    : null;

  return `
            <p style="margin:20px 0 12px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              If you did <strong style="color:#e4e4e7;">not</strong> make this change, contact support immediately:
            </p>
            <p style="margin:0 0 12px;">
              <a href="${dashboardSupportUrl}" style="display:inline-block;background:#3f3f46;color:#fafafa;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Notify support (dashboard)
              </a>
            </p>
            ${
              mailtoHref && alertMailbox
                ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a;">
              Or email: <a href="${mailtoHref}" style="color:#93c5fd;text-decoration:underline;">${alertMailbox}</a>
            </p>`
                : `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a;">
              Sign in and open the <strong style="color:#a1a1aa;">Support</strong> tab if you cannot reach your account.
            </p>`
            }`;
}

function wrapEmail(innerTitle: string, innerBody: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">${innerTitle}</p>
            ${innerBody}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Security notice when the shop owner changes their dashboard password.
 */
export async function sendShopPasswordChangedNotificationEmail(
  toEmail: string,
): Promise<SendResult> {
  const when = new Date().toUTCString();
  const body = `
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              The password for your shop dashboard account was just changed (${when} UTC).
            </p>
            ${securityFooterHtml()}`;
  const html = wrapEmail("Your dashboard password was changed", body);
  return sendTransactionalShopEmail({
    toEmail,
    subject: "Your shop dashboard password was changed",
    html,
    logTag: "shop-password-changed-notify",
  });
}

/**
 * Security notice sent to the **previous** address after sign-in email is updated.
 */
export async function sendShopEmailChangedNotificationToPreviousEmail(args: {
  previousEmail: string;
  newEmail: string;
}): Promise<SendResult> {
  const when = new Date().toUTCString();
  const body = `
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              The sign-in email for your shop dashboard was changed from
              <strong style="color:#e4e4e7;">${escapeHtml(args.previousEmail)}</strong>
              to <strong style="color:#e4e4e7;">${escapeHtml(args.newEmail)}</strong>
              (${when} UTC).
            </p>
            ${securityFooterHtml()}`;
  const html = wrapEmail("Your sign-in email was changed", body);
  return sendTransactionalShopEmail({
    toEmail: args.previousEmail,
    subject: "Your shop dashboard sign-in email was changed",
    html,
    logTag: "shop-email-changed-notify-prev",
  });
}

/**
 * Security notice sent to the **new** address (in addition to the verification email).
 */
export async function sendShopEmailChangedNotificationToNewEmail(args: {
  newEmail: string;
  previousEmail: string;
}): Promise<SendResult> {
  const when = new Date().toUTCString();
  const body = `
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              This address is now the sign-in email for your shop dashboard (previously
              <strong style="color:#e4e4e7;">${escapeHtml(args.previousEmail)}</strong>), effective ${when} UTC.
              You will receive a separate message with a link to verify this email.
            </p>
            ${securityFooterHtml()}`;
  const html = wrapEmail("New sign-in email for your shop dashboard", body);
  return sendTransactionalShopEmail({
    toEmail: args.newEmail,
    subject: "Your shop dashboard sign-in email update",
    html,
    logTag: "shop-email-changed-notify-new",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendTransactionalShopEmail(opts: {
  toEmail: string;
  subject: string;
  html: string;
  logTag: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.SHOP_PASSWORD_CHANGED_EMAIL_FROM,
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
  ]);
  if (!fromResult.ok) {
    return { ok: false, error: fromResult.error };
  }
  const from = fromResult.from;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[${opts.logTag}] (no RESEND_API_KEY) would send to ${opts.toEmail} subject=${JSON.stringify(opts.subject)}`,
      );
      return { ok: true };
    }
    console.error(`[${opts.logTag}] RESEND_API_KEY missing; notification not sent to ${opts.toEmail}`);
    return {
      ok: false,
      error: "Transactional email is not configured (RESEND_API_KEY).",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.toEmail],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    console.error(`[${opts.logTag}] Resend HTTP error`, {
      status: res.status,
      body: text.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(res.status, text) };
  }

  return { ok: true };
}

/**
 * Thank-you sent to the shop owner when an admin marks their bug/feedback report resolved.
 */
export async function sendBugFeedbackResolvedThankYouEmail(opts: {
  toEmail: string;
  shopDisplayName: string;
}): Promise<SendResult> {
  const origin = emailLinkOrigin();
  const bugFeedbackDash = dashQueryParamForTabId("bugFeedback");
  const dashboardUrl = `${origin}/dashboard?dash=${encodeURIComponent(bugFeedbackDash)}`;
  const name = escapeHtml(opts.shopDisplayName.trim() || "your shop");
  const body = `
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              Thank you for your bug report and feedback about <strong style="color:#e4e4e7;">${name}</strong>.
              We&apos;ve marked your submission as resolved.
            </p>
            <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              You can always send more from your dashboard:
            </p>
            <p style="margin:0 0 16px;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#3f3f46;color:#fafafa;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Open Bug / Feedback
              </a>
            </p>`;
  const html = wrapEmail("Your feedback has been resolved", body);
  return sendTransactionalShopEmail({
    toEmail: opts.toEmail,
    subject: "Thank you — your bug/feedback has been resolved",
    html,
    logTag: "bug-feedback-resolved-thanks",
  });
}
