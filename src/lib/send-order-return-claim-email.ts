import {
  postResendTransactionalEmail,
  resolveShopAutomatedTransactionalEmailFrom,
} from "@/lib/resend-shop-from";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";
import type { OrderReturnClaimEmailVars } from "@/lib/order-return-claim-email-placeholders";
import { resolveOrderReturnClaimConfirmationEmail } from "@/lib/site-email-template-service";

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

export async function sendOrderReturnClaimConfirmationEmail(args: {
  toEmail: string;
  orderNumber: number;
  claimId: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopAutomatedTransactionalEmailFrom();
  if (!fromResult.ok) return { ok: false, error: fromResult.error };
  const from = fromResult.from;

  const vars: OrderReturnClaimEmailVars = {
    orderNumberLabel: formatBuyerOrderNumberShort(args.orderNumber),
    claimId: args.claimId,
  };

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[order-return-claim] (no RESEND_API_KEY) confirmation for ${args.toEmail} claim ${args.claimId}`,
      );
      return { ok: true };
    }
    return {
      ok: false,
      error: "Email is not configured: set RESEND_API_KEY in the server environment.",
    };
  }

  const { subject, html } = await resolveOrderReturnClaimConfirmationEmail(vars);

  console.info(
    `[order-return-claim] Resend POST from=${JSON.stringify(from)} to=${JSON.stringify(args.toEmail)} claim=${args.claimId}`,
  );

  const sent = await postResendTransactionalEmail({
    apiKey,
    from,
    to: [args.toEmail],
    subject,
    html,
    logTag: "order-return-claim",
  });

  if (!sent.ok) {
    return { ok: false, error: resendUserFacingError(sent.status, sent.body) };
  }
  return { ok: true };
}
