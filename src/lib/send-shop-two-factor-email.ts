import { resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";
import { resolveShopTwoFactorConfirmDeviceEmail } from "@/lib/site-email-template-service";

type SendResult = { ok: true } | { ok: false; error: string };

export async function sendShopTwoFactorConfirmEmail(args: {
  toEmail: string;
  confirmUrl: string;
  deviceLabel: string;
  expiresAt: Date;
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

  const resolved = await resolveShopTwoFactorConfirmDeviceEmail(args.confirmUrl);
  const subject = resolved.subject;
  const html = resolved.html;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[shop-2fa] (no RESEND_API_KEY) would send to ${args.toEmail} subject=${JSON.stringify(subject)} confirmUrl=${args.confirmUrl}`,
      );
      return { ok: true };
    }
    return { ok: false, error: "Transactional email is not configured (RESEND_API_KEY)." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.toEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${bodyText || "unknown"}` };
  }
  return { ok: true };
}

