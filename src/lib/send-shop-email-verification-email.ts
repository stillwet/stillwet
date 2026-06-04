import { emailLinkOrigin } from "@/lib/public-app-url";
import { postResendTransactionalEmail, resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";
import { resolveShopEmailVerificationEmail } from "@/lib/site-email-template-service";

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
  if (msg) {
    return `Email could not be sent (${status}): ${msg}`;
  }
  return `Email could not be sent (HTTP ${status}).`;
}

export async function sendShopEmailVerificationEmail(
  toEmail: string,
  rawToken: string,
): Promise<SendResult> {
  const origin = emailLinkOrigin();
  const url = `${origin}/dashboard/verify-email?t=${encodeURIComponent(rawToken)}`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.SHOP_EMAIL_VERIFICATION_EMAIL_FROM,
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
  ]);
  if (!fromResult.ok) {
    return { ok: false, error: fromResult.error };
  }
  const from = fromResult.from;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[shop-email-verify] (no RESEND_API_KEY) link for ${toEmail}:\n${url}`);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "Email is not configured: set RESEND_API_KEY in the server environment, then redeploy.",
    };
  }

  const { subject, html } = await resolveShopEmailVerificationEmail(url);

  const sent = await postResendTransactionalEmail({
    apiKey,
    from,
    to: [toEmail],
    subject,
    html,
    logTag: "shop-email-verify",
  });

  if (!sent.ok) {
    console.error("[shop-email-verify] Resend HTTP error", {
      status: sent.status,
      from: sent.fromUsed,
      body: sent.body.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(sent.status, sent.body) };
  }

  return { ok: true };
}
