import type { PrismaClient } from "@/generated/prisma/client";
import { OrderStatus, SupportMessageAuthor } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export type AdminSummaryMetrics = {
  periodLabel: string;
  /** Distinct listing rows that entered the queue or were submitted in the window */
  newListingRequests: number;
  /** Custom storefront image submitted for admin review */
  imageReviewRequests: number;
  /** Creator messages in support threads */
  supportCreatorMessages: number;
  bugFeedbackReports: number;
  /** New shop owner accounts (excludes platform shop) */
  newCreatorAccounts: number;
  /** Listing publication fees satisfied (`listingFeePaidAt`) */
  newPaidListings: number;
  /** Lines on paid checkout orders */
  paidOrderLines: number;
};

export function adminSummaryTotalNew(m: AdminSummaryMetrics): number {
  return (
    m.newListingRequests +
    m.imageReviewRequests +
    m.supportCreatorMessages +
    m.bugFeedbackReports +
    m.newCreatorAccounts +
    m.newPaidListings +
    m.paidOrderLines
  );
}

/**
 * Metrics for [periodStart, periodEnd) in UTC (exclusive end recommended via lt).
 */
export async function computeAdminSummaryMetrics(
  prisma: PrismaClient,
  opts: {
    periodStart: Date;
    periodEnd: Date;
    periodLabel: string;
  },
): Promise<AdminSummaryMetrics> {
  const { periodStart, periodEnd, periodLabel } = opts;

  const [listingRows, imageCount, supportCount, bugCount, accountsCount, paidListingCount, salesLines] =
    await Promise.all([
      prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT DISTINCT sl.id
          FROM "ShopListing" sl
          WHERE (
            (sl."createdAt" >= ${periodStart} AND sl."createdAt" < ${periodEnd}
              AND sl."requestStatus" <> 'draft'::"ListingRequestStatus")
            OR (
              sl."updatedAt" >= ${periodStart} AND sl."updatedAt" < ${periodEnd}
              AND sl."requestStatus" = 'submitted'::"ListingRequestStatus"
            )
          )
        ) sub
      `,
      prisma.shopListing.count({
        where: {
          ownerSupplementPendingSubmittedAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.supportMessage.count({
        where: {
          authorRole: SupportMessageAuthor.creator,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.bugFeedbackReport.count({
        where: { createdAt: { gte: periodStart, lt: periodEnd } },
      }),
      prisma.shopUser.count({
        where: {
          createdAt: { gte: periodStart, lt: periodEnd },
          shop: { slug: { not: PLATFORM_SHOP_SLUG } },
        },
      }),
      prisma.shopListing.count({
        where: {
          listingFeePaidAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.orderLine.count({
        where: {
          order: {
            status: OrderStatus.paid,
            createdAt: { gte: periodStart, lt: periodEnd },
          },
        },
      }),
    ]);

  const newListingRequests = Number(listingRows[0]?.c ?? 0);

  return {
    periodLabel,
    newListingRequests,
    imageReviewRequests: imageCount,
    supportCreatorMessages: supportCount,
    bugFeedbackReports: bugCount,
    newCreatorAccounts: accountsCount,
    newPaidListings: paidListingCount,
    paidOrderLines: salesLines,
  };
}

export function formatAdminSummaryEmailText(m: AdminSummaryMetrics): string {
  const totalNew = adminSummaryTotalNew(m);

  // Plain-text fallback (HTML version renders a real table).
  const lines = [
    `Daily Admin Summary — ${m.periodLabel}`,
    "",
    `Listing requests: ${m.newListingRequests}`,
    `Image reviews: ${m.imageReviewRequests}`,
    `Support messages: ${m.supportCreatorMessages}`,
    `Bug / feedback: ${m.bugFeedbackReports}`,
    `New creators: ${m.newCreatorAccounts}`,
    `Paid listings: ${m.newPaidListings}`,
    `Paid orders: ${m.paidOrderLines}`,
    "",
    `Total new: ${totalNew}`,
  ];
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAdminSummaryEmailHtml(m: AdminSummaryMetrics): string {
  const totalNew = adminSummaryTotalNew(m);
  const title = `Daily Admin Summary — ${m.periodLabel}`;
  const rows: Array<[string, number]> = [
    ["Listing requests", m.newListingRequests],
    ["Image reviews", m.imageReviewRequests],
    ["Support messages", m.supportCreatorMessages],
    ["Bug / feedback", m.bugFeedbackReports],
    ["New creators", m.newCreatorAccounts],
    ["Paid listings", m.newPaidListings],
    ["Paid orders", m.paidOrderLines],
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `<tr>
  <td style="padding:10px 12px;border-top:1px solid #27272a;color:#e4e4e7;font-size:13px;">${escapeHtml(label)}</td>
  <td align="right" style="padding:10px 12px;border-top:1px solid #27272a;color:#fafafa;font-size:13px;font-weight:600;">${value}</td>
</tr>`,
    )
    .join("\n");

  const totalRow = `<tr>
  <td style="padding:12px;border-top:1px solid #27272a;color:#a1a1aa;font-size:13px;font-weight:600;">Total new</td>
  <td align="right" style="padding:12px;border-top:1px solid #27272a;color:#e4e4e7;font-size:13px;font-weight:600;">${totalNew}</td>
</tr>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            <p style="margin:0 0 14px;font-size:14px;font-weight:600;color:#fafafa;">${escapeHtml(title)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #27272a;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
              <tr>
                <th align="left" style="padding:10px 12px;background:#111113;color:#a1a1aa;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">Type</th>
                <th align="right" style="padding:10px 12px;background:#111113;color:#a1a1aa;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">New</th>
              </tr>
              ${tableRows}
              ${totalRow}
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
