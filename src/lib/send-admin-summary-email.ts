import {
  formatAdminSummaryEmailHtml,
  formatAdminSummaryEmailText,
  type AdminSummaryMetrics,
} from "@/lib/admin-summary-metrics";
import { resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";

export async function sendAdminSummaryEmail(params: {
  to: string[];
  metrics: AdminSummaryMetrics;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set." };
  }
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.ADMIN_SUMMARY_FROM_EMAIL,
    process.env.CONTACT_QUOTE_FROM_EMAIL,
  ]);
  if (!fromResult.ok) {
    return { ok: false, error: fromResult.error };
  }
  const from = fromResult.from;
  if (params.to.length === 0) {
    return { ok: false, error: "No recipient addresses." };
  }

  const text = formatAdminSummaryEmailText(params.metrics);
  const html = formatAdminSummaryEmailHtml(params.metrics);
  const subject = `Daily Admin Summary — ${params.metrics.periodLabel}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${body || "unknown"}` };
  }
  return { ok: true };
}
