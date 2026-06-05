import { resolveShopTransactionalEmailFrom, postResendTransactionalEmail } from "@/lib/resend-shop-from";
import type { GiftRedemptionEmailVars } from "@/lib/email-template-placeholders";
import { resolveGiftRedemptionCodeEmail } from "@/lib/site-email-template-service";

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
  return msg ? `Email could not be sent (${status}): ${msg}` : `Email could not be sent (HTTP ${status}).`;
}

export async function sendGiftRedemptionCodeEmail(
  args: GiftRedemptionEmailVars & { toEmail: string },
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.SHOP_GIFT_CODE_EMAIL_FROM,
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
  ]);
  if (!fromResult.ok) return { ok: false, error: fromResult.error };

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[gift-code-email] (no RESEND_API_KEY) setup code for ${args.toEmail}: ${args.setupCode}`,
      );
      return { ok: true };
    }
    return {
      ok: false,
      error: "Email is not configured: set RESEND_API_KEY in the server environment, then redeploy.",
    };
  }

  const { subject, html } = await resolveGiftRedemptionCodeEmail({
    setupCode: args.setupCode,
  });

  console.info(
    `[gift-code-email] Resend POST to=${JSON.stringify(args.toEmail)} setupCodePresent=${Boolean(args.setupCode?.trim())}`,
  );

  const sent = await postResendTransactionalEmail({
    apiKey,
    from: fromResult.from,
    to: [args.toEmail],
    subject,
    html,
    logTag: "gift-code-email",
  });

  if (!sent.ok) {
    console.error("[gift-code-email] Resend HTTP error", {
      status: sent.status,
      body: sent.body.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(sent.status, sent.body) };
  }

  return { ok: true };
}
