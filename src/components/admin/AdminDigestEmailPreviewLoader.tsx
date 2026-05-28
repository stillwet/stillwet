import { prisma } from "@/lib/prisma";
import { computeReportingWindow } from "@/lib/admin-summary-email-schedule";
import {
  computeAdminSummaryMetrics,
  formatAdminSummaryEmailHtml,
  formatAdminSummaryEmailText,
} from "@/lib/admin-summary-metrics";
import type { AdminSummaryEmailSettingsDTO } from "@/lib/admin-summary-email-settings-dto";

const digestShellClass =
  "overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/50 shadow-sm ring-1 ring-white/[0.04]";

/** Mirrors `SHOP_EMAIL_VERIFICATION_HTML_TEMPLATE` chrome in `shop-email-verification-email-html.ts`. */
function buildAdminDigestEmailPreviewDocument(html: string): string {
  return html;
}

export function AdminDigestEmailPreviewSkeleton() {
  return (
    <div className={digestShellClass} aria-busy aria-label="Loading digest preview">
      <div className="border-b border-zinc-800/80 bg-zinc-900/25 px-4 py-3.5">
        <div className="h-4 w-44 animate-pulse rounded-md bg-zinc-800/90" />
        <div className="mt-2 h-3 max-w-md animate-pulse rounded bg-zinc-800/50" />
      </div>
      <div className="space-y-4 p-4">
        <div className="h-36 animate-pulse rounded-xl bg-zinc-900/70 ring-1 ring-inset ring-zinc-800/60" />
        <div>
          <div className="mb-2 h-2.5 w-28 animate-pulse rounded bg-zinc-800/70" />
          <div className="h-[min(45vh,320px)] animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40" />
        </div>
      </div>
    </div>
  );
}

/** Server-only: loads metrics for the current reporting window (same as Send now). */
export async function AdminDigestEmailPreviewLoader(props: {
  frequency: AdminSummaryEmailSettingsDTO["frequency"];
}) {
  const digestWindow = computeReportingWindow(props.frequency, new Date());
  const digestMetrics = await computeAdminSummaryMetrics(prisma, {
    periodStart: digestWindow.periodStartUtc,
    periodEnd: digestWindow.periodEndUtc,
    periodLabel: digestWindow.periodLabel,
  });
  const plainText = formatAdminSummaryEmailText(digestMetrics);
  const bodyForPreview = plainText.trim().length > 0 ? plainText : "No preview text available.";
  const emailPreviewSrcDoc = buildAdminDigestEmailPreviewDocument(formatAdminSummaryEmailHtml(digestMetrics));

  return (
    <div className={digestShellClass}>
      <div className="border-b border-zinc-800/80 bg-zinc-900/30 px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-100">Admin digest email</h3>
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Plain text</span>
        </div>
        <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-zinc-500">
          Current reporting window (same as Send now). This is not a shop HTML template.
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Source (plain text)</p>
          <pre
            className="max-h-[min(50vh,360px)] overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-[#27272a] bg-[#18181b] px-5 py-5 font-sans text-[13px] leading-relaxed text-[#a1a1aa] subpixel-antialiased [scrollbar-color:rgba(113,113,122,0.35)_transparent]"
            tabIndex={0}
          >
            {bodyForPreview}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Email preview</p>
          <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
            Matches shop “verify email” layout: dark outer background (#0a0a0a), 520px card (#18181b / #27272a border), headline + body typography.
          </p>
          <iframe
            title="Admin digest email client preview"
            sandbox=""
            className="h-[min(45vh,320px)] w-full max-w-[996px] rounded-xl border border-zinc-800 bg-[#0a0a0a] shadow-inner"
            srcDoc={emailPreviewSrcDoc}
          />
        </div>
      </div>
    </div>
  );
}
