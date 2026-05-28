import { publicAppBaseUrl } from "@/lib/public-app-url";

export const SHOP_NEW_SALE_NOTICE_KIND = "new_sale";

function salesTabNoticeUrl(): string {
  const base = publicAppBaseUrl()?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/dashboard?dash=orders`;
}

export function shopNewSaleNoticeBody(): string {
  const salesUrl = salesTabNoticeUrl();
  return (
    `You have a new sale. Order details may take up to 24 hours to appear on the ` +
    `[Sales tab](${salesUrl}). You'll get a notification here when sales happen; open Sales for your daily summary.`
  );
}
