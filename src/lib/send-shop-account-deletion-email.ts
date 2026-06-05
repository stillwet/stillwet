import { emailLinkOrigin } from "@/lib/public-app-url";
import { postResendTransactionalEmail, resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";
import { resolveShopAccountDeletionConfirmEmail } from "@/lib/site-email-template-service";

type SendResult = { ok: true } | { ok: false; error: string };

function resendUserFacingError(status: number, body: string, from: string): string {
  let msg = "";
  try {
    const j = JSON.parse(body) as { message?: string };
    if (typeof j?.message === "string" && j.message.trim()) {
      msg = j.message.trim().slice(0, 280);
    }
  } catch {
    if (body.trim()) msg = body.trim().slice(0, 280);
  }
  const fromDomain = from.match(/@([^>\s]+)/)?.[1];
  const fromHint = fromDomain
    ? ` (From: ${fromDomain} — set SHOP_PASSWORD_RESET_EMAIL_FROM to a verified Resend domain, e.g. noreply@auto.stillwet.com)`
    : "";
  if (msg) {
    return `Email could not be sent (${status}): ${msg}${fromHint}`;
  }
  return `Email could not be sent (HTTP ${status}). Check Vercel logs for [shop-account-deletion].${fromHint}`;
}

export async function sendShopAccountDeletionConfirmEmail(
  toEmail: string,
  rawToken: string,
): Promise<SendResult> {
  const origin = emailLinkOrigin();
  const url = `${origin}/account-deletion/confirm?t=${encodeURIComponent(rawToken)}`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
    process.env.SHOP_ACCOUNT_DELETION_EMAIL_FROM,
  ]);
  if (!fromResult.ok) {
    return { ok: false, error: fromResult.error };
  }
  const from = fromResult.from;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[shop-account-deletion] (no RESEND_API_KEY) link for ${toEmail}:\n${url}`);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        "Email is not configured: set RESEND_API_KEY in the server environment, then redeploy.",
    };
  }

  const { subject, html } = await resolveShopAccountDeletionConfirmEmail(url);

  console.info(
    `[shop-account-deletion] Resend POST from=${JSON.stringify(from)} origin=${JSON.stringify(origin)} toDomain=${JSON.stringify(toEmail.includes("@") ? toEmail.split("@")[1] : "?")}`,
  );

  const sent = await postResendTransactionalEmail({
    apiKey,
    from,
    to: [toEmail],
    subject,
    html,
    logTag: "shop-account-deletion",
  });

  if (!sent.ok) {
    console.error("[shop-account-deletion] Resend HTTP error", {
      status: sent.status,
      from: sent.fromUsed,
      body: sent.body.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(sent.status, sent.body, sent.fromUsed) };
  }

  let emailId = "";
  try {
    const j = JSON.parse(sent.body) as { id?: string };
    if (typeof j?.id === "string") emailId = j.id;
  } catch {
    /* ignore */
  }
  console.info(
    `[shop-account-deletion] Resend accepted email${emailId ? ` id=${emailId}` : ""} from=${JSON.stringify(sent.fromUsed)} (track delivery in Resend → Emails / Logs)`,
  );

  return { ok: true };
}
