import { resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";
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

export async function sendGiftRedemptionCodeEmail(args: {
  toEmail: string;
  setupCode: string;
  listingCode: string;
  listingCredits: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.SHOP_GIFT_CODE_EMAIL_FROM,
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
  ]);
  if (!fromResult.ok) return { ok: false, error: fromResult.error };

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[gift-code-email] (no RESEND_API_KEY) codes for ${args.toEmail}: setup=${args.setupCode} listing=${args.listingCode}`,
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
    listingCode: args.listingCode,
    listingCredits: args.listingCredits,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromResult.from,
      to: [args.toEmail],
      subject,
      html,
    }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("[gift-code-email] Resend HTTP error", {
      status: res.status,
      body: text.slice(0, 2000),
    });
    return { ok: false, error: resendUserFacingError(res.status, text) };
  }
  return { ok: true };
}
