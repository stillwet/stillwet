import { formatResendDomainNotVerifiedHint } from "@/lib/resend-api-client";
import {
  postResendTransactionalEmail,
  resolveShopAutomatedTransactionalEmailFrom,
} from "@/lib/resend-shop-from";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";
import type { OrderReturnClaimRejectionReason } from "@/generated/prisma/enums";
import { orderReturnClaimRejectionReasonLabel } from "@/lib/order-return-claim-rejection-reasons";
import { emailLinkOrigin } from "@/lib/public-app-url";
import {
  resolveOrderReturnClaimAcceptedEmail,
  resolveOrderReturnClaimRejectedEmail,
} from "@/lib/site-email-template-service";

type SendResult = { ok: true } | { ok: false; error: string };

function resendUserFacingError(status: number, body: string, fromUsed?: string): string {
  let msg = "";
  try {
    const j = JSON.parse(body) as { message?: string };
    if (typeof j?.message === "string" && j.message.trim()) {
      msg = j.message.trim().slice(0, 280);
    }
  } catch {
    if (body.trim()) msg = body.trim().slice(0, 280);
  }
  const base = msg
    ? `Email could not be sent (${status}): ${msg}`
    : `Email could not be sent (HTTP ${status}).`;
  if (
    status === 403 &&
    fromUsed &&
    /domain is not verified/i.test(msg)
  ) {
    return `${base} ${formatResendDomainNotVerifiedHint(fromUsed)}`;
  }
  return base;
}

async function sendTransactional(args: {
  toEmail: string;
  subject: string;
  html: string;
  logTag: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromResult = resolveShopAutomatedTransactionalEmailFrom();
  if (!fromResult.ok) return { ok: false, error: fromResult.error };
  const from = fromResult.from;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[${args.logTag}] (no RESEND_API_KEY) to ${args.toEmail}: ${args.subject}`);
      return { ok: true };
    }
    return {
      ok: false,
      error: "Email is not configured: set RESEND_API_KEY in the server environment.",
    };
  }

  console.info(
    `[${args.logTag}] Resend POST from=${JSON.stringify(from)} to=${JSON.stringify(args.toEmail)}`,
  );

  const sent = await postResendTransactionalEmail({
    apiKey,
    from,
    to: [args.toEmail],
    subject: args.subject,
    html: args.html,
    logTag: args.logTag,
  });

  if (!sent.ok) {
    return { ok: false, error: resendUserFacingError(sent.status, sent.body, sent.fromUsed) };
  }
  return { ok: true };
}

export async function sendOrderReturnClaimRejectedEmail(args: {
  toEmail: string;
  orderNumber: number;
  claimId: string;
  rejectionReason: OrderReturnClaimRejectionReason;
}): Promise<SendResult> {
  const returnsPolicyUrl = `${emailLinkOrigin()}/returns`;
  const { subject, html } = await resolveOrderReturnClaimRejectedEmail({
    orderNumberLabel: formatBuyerOrderNumberShort(args.orderNumber),
    claimId: args.claimId,
    rejectionReasonLabel: orderReturnClaimRejectionReasonLabel(args.rejectionReason),
    returnsPolicyUrl,
  });

  return sendTransactional({
    toEmail: args.toEmail,
    subject,
    html,
    logTag: "order-return-claim-rejected",
  });
}

export async function sendOrderReturnClaimAcceptedEmail(args: {
  toEmail: string;
  orderNumber: number;
  claimId: string;
}): Promise<SendResult> {
  const { subject, html } = await resolveOrderReturnClaimAcceptedEmail({
    orderNumberLabel: formatBuyerOrderNumberShort(args.orderNumber),
    claimId: args.claimId,
  });

  return sendTransactional({
    toEmail: args.toEmail,
    subject,
    html,
    logTag: "order-return-claim-accepted",
  });
}
