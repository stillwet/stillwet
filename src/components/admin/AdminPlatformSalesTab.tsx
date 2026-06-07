import Link from "next/link";
import type {
  AdminPlatformSalesBuyer,
  AdminPlatformSalesMergedLine,
  PlatformSalesPeriodTotals,
  PlatformSalesYtdTotals,
} from "@/lib/admin-platform-sales-merged-lines";
import { AdminClearPlatformSalesForm } from "@/components/admin/AdminClearPlatformSalesForm";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function PlatformRevenueTotalsCard({
  title,
  totals,
  tone = "default",
}: {
  title: string;
  totals: PlatformSalesPeriodTotals;
  tone?: "default" | "subtle";
}) {
  const combined =
    totals.listingPlatformCents +
    totals.promotionPlatformCents +
    totals.itemPlatformCents +
    totals.supportPlatformCents;
  const subtle = tone === "subtle";
  const cardClass = subtle
    ? "rounded-lg border border-zinc-800/35 bg-zinc-950/15 px-3 py-3 text-xs"
    : "rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-3 text-xs";
  const titleClass = subtle
    ? "font-medium uppercase tracking-wide text-zinc-600"
    : "font-medium uppercase tracking-wide text-zinc-500";
  const metricOutline = subtle
    ? "rounded-md border border-zinc-800/40 bg-zinc-950/10 px-2 py-1.5"
    : "rounded-md border border-zinc-800/70 bg-zinc-950/25 px-2 py-1.5";
  const dtClass = subtle
    ? "text-[10px] uppercase tracking-wide text-zinc-600/90"
    : "text-[10px] uppercase tracking-wide text-zinc-600";
  const ddClass = subtle ? "tabular-nums text-zinc-400" : "tabular-nums text-zinc-200";
  const combinedWrap = subtle
    ? "rounded-md border border-blue-500/25 bg-blue-950/20 px-2 py-1.5"
    : "rounded-md border border-blue-500/45 bg-blue-950/35 px-2 py-1.5";
  const combinedDt = subtle
    ? "text-[10px] uppercase tracking-wide text-blue-400/55"
    : "text-[10px] uppercase tracking-wide text-blue-400/90";
  const combinedDd = subtle ? "tabular-nums text-blue-200/75" : "tabular-nums text-blue-100";
  return (
    <div className={cardClass}>
      <p className={titleClass}>{title}</p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className={metricOutline}>
          <dt className={dtClass}>Listing fees</dt>
          <dd className={ddClass}>{formatPrice(totals.listingPlatformCents)}</dd>
        </div>
        <div className={metricOutline}>
          <dt className={dtClass}>Promotions</dt>
          <dd className={ddClass}>{formatPrice(totals.promotionPlatformCents)}</dd>
        </div>
        <div className={metricOutline}>
          <dt className={dtClass}>Merchandise (platform fee)</dt>
          <dd className={ddClass}>{formatPrice(totals.itemPlatformCents)}</dd>
        </div>
        <div className={metricOutline}>
          <dt className={dtClass}>Support tips</dt>
          <dd className={ddClass}>{formatPrice(totals.supportPlatformCents)}</dd>
        </div>
        <div className={combinedWrap}>
          <dt className={combinedDt}>Combined</dt>
          <dd className={combinedDd}>{formatPrice(combined)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Local calendar date for table display (e.g. `04-25-26`). */
function formatDateMMDDYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}-${dd}-${yy}`;
}

function escapeCsvCell(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildSalesTabHref(parts: {
  salesFrom?: string;
  salesTo?: string;
  salesKind?: string;
}): string {
  const u = new URLSearchParams();
  u.set("tab", "sales");
  if (parts.salesFrom?.trim()) u.set("salesFrom", parts.salesFrom.trim());
  if (parts.salesTo?.trim()) u.set("salesTo", parts.salesTo.trim());
  if (parts.salesKind && parts.salesKind !== "all") u.set("salesKind", parts.salesKind);
  const q = u.toString();
  return `/admin?${q}`;
}

function formatBuyerCell(l: AdminPlatformSalesMergedLine, field: keyof AdminPlatformSalesBuyer): string {
  if (l.kind !== "merchandise") return "—";
  const v = l.buyer[field]?.trim();
  return v || "—";
}

function formatBuyerShipTo(l: AdminPlatformSalesMergedLine): string {
  if (l.kind !== "merchandise") return "—";
  const country = l.buyer.shippingCountry?.trim().toUpperCase() ?? "";
  const state = l.buyer.shippingState?.trim().toUpperCase() ?? "";
  const isUs = country === "US" || country === "USA" || (!country && state.length > 0);
  if (isUs) return state || "—";
  return country || "—";
}

function formatMerchandiseOrderNumber(l: AdminPlatformSalesMergedLine): string {
  if (l.kind !== "merchandise") return "—";
  return formatBuyerOrderNumberShort(l.order.orderNumber);
}

export function AdminPlatformSalesTab(props: {
  lines: AdminPlatformSalesMergedLine[];
  salesFromValue: string;
  salesToValue: string;
  salesKind: "all" | "listing" | "item" | "support" | "promotion";
  monthSummaries: {
    currentMonthTitle: string;
    previousMonthTitle: string;
    currentTotals: PlatformSalesPeriodTotals;
    previousTotals: PlatformSalesPeriodTotals;
    ytdTotals: PlatformSalesYtdTotals;
    priorCalendarYearTotals: PlatformSalesYtdTotals;
  } | null;
  /** Server: allow destructive clear outside prod or when env flag set. */
  clearSalesHistoryEnabled: boolean;
}) {
  const { lines, salesFromValue, salesToValue, salesKind, monthSummaries, clearSalesHistoryEnabled } = props;

  const csvBody = lines
    .map((l) => {
      const merch =
        l.kind === "listing_publication_fee" ||
        l.kind === "listing_credit_pack_purchase" ||
        l.kind === "promotion_purchase"
          ? 0
          : l.unitPriceCents * l.quantity;
      const shopName = l.shop?.displayName ?? "";
      const shopSlug = l.shop?.slug ?? "";
      const buyerEmail = l.kind === "merchandise" ? l.buyer.email ?? "" : "";
      const buyerShipTo = l.kind === "merchandise" ? formatBuyerShipTo(l) : "";
      const buyerShipToCsv = buyerShipTo === "—" ? "" : buyerShipTo;
      const orderNumber = l.kind === "merchandise" ? String(l.order.orderNumber) : "";
      return [
        l.order.createdAt.toISOString(),
        orderNumber,
        l.order.id,
        l.productName,
        String(l.quantity),
        String(merch),
        String(l.goodsServicesCostCents),
        String(l.platformCutCents),
        String(l.shopCutCents),
        shopName,
        shopSlug,
        buyerEmail,
        buyerShipToCsv,
      ]
        .map((c) => escapeCsvCell(c))
        .join(",");
    })
    .join("\n");
  const csv =
    "date,order_number,order_id,item,qty,merchandise_cents,goods_services_cents,platform_fee_cents,shop_cut_cents,shop_name,shop_slug,buyer_email,buyer_ship_to\n" +
    csvBody;
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  const kindHref = (k: "all" | "listing" | "item" | "support" | "promotion") =>
    buildSalesTabHref({
      salesFrom: salesFromValue,
      salesTo: salesToValue,
      salesKind: k === "all" ? undefined : k,
    });

  const kindBtn = (k: "all" | "listing" | "item" | "support" | "promotion", label: string) => {
    const active = salesKind === k;
    return (
      <Link
        href={kindHref(k)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          active
            ? "border-zinc-500 bg-zinc-800/90 text-zinc-100"
            : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <section aria-label="Platform sales">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Platform sales</h2>

      {monthSummaries ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <PlatformRevenueTotalsCard
              title={`YTD ${monthSummaries.ytdTotals.year}`}
              totals={monthSummaries.ytdTotals}
            />
            <PlatformRevenueTotalsCard title={monthSummaries.currentMonthTitle} totals={monthSummaries.currentTotals} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <PlatformRevenueTotalsCard
              tone="subtle"
              title={`${monthSummaries.priorCalendarYearTotals.year} total earnings`}
              totals={monthSummaries.priorCalendarYearTotals}
            />
            <PlatformRevenueTotalsCard
              tone="subtle"
              title={monthSummaries.previousMonthTitle}
              totals={monthSummaries.previousTotals}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by sale type">
        {kindBtn("all", "All")}
        {kindBtn("listing", "Listing")}
        {kindBtn("promotion", "Promotion")}
        {kindBtn("item", "Item")}
        {kindBtn("support", "Support")}
      </div>

      <form
        method="get"
        className="mt-4 flex flex-wrap items-end gap-3 text-xs"
        action="/admin"
      >
        <input type="hidden" name="tab" value="sales" />
        {salesKind !== "all" ? <input type="hidden" name="salesKind" value={salesKind} /> : null}
        <label className="text-zinc-500">
          From (ISO date)
          <input
            type="text"
            name="salesFrom"
            defaultValue={salesFromValue}
            placeholder="2026-01-01"
            className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
          />
        </label>
        <label className="text-zinc-500">
          To (ISO date)
          <input
            type="text"
            name="salesTo"
            defaultValue={salesToValue}
            placeholder="2026-12-31"
            className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-zinc-200"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-700"
        >
          Filter
        </button>
        <a
          href={csvHref}
          download="platform-sales-lines.csv"
          className="rounded border border-zinc-600 px-3 py-1 text-zinc-300 hover:border-zinc-400"
        >
          Download CSV
        </a>
        <Link href="/admin?tab=sales" className="text-zinc-500 hover:text-zinc-300">
          Clear dates &amp; filters
        </Link>
      </form>

      <p className="mt-3 text-[11px] text-zinc-600">
        Item sales include buyer email and ship-to (US state or non-US country) from Stripe checkout. Other sale types show —.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-2 font-medium">Date</th>
              <th className="py-2 pr-2 font-medium">Order</th>
              <th className="py-2 pr-2 font-medium">Item</th>
              <th className="py-2 pr-2 font-medium">Qty</th>
              <th className="py-2 pr-2 font-medium">Merch</th>
              <th className="py-2 pr-2 font-medium">Platform</th>
              <th className="py-2 pr-2 font-medium">Buyer email</th>
              <th className="py-2 font-medium">Ship-to</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const isPubFee =
                l.kind === "listing_publication_fee" ||
        l.kind === "listing_credit_pack_purchase" ||
        l.kind === "promotion_purchase";
              const merch = isPubFee ? 0 : l.unitPriceCents * l.quantity;
              return (
                <tr key={l.id} className="border-b border-zinc-900 text-zinc-300">
                  <td className="py-2 pr-2 font-mono text-[10px] text-zinc-500">
                    {formatDateMMDDYY(l.order.createdAt)}
                  </td>
                  <td className="py-2 pr-2 font-mono tabular-nums text-zinc-400">
                    {formatMerchandiseOrderNumber(l)}
                  </td>
                  <td className="py-2 pr-2">
                    {l.itemHref ? (
                      <Link
                        href={l.itemHref}
                        className="text-zinc-300 hover:text-blue-300 hover:underline"
                      >
                        {l.productName}
                      </Link>
                    ) : (
                      l.productName
                    )}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{l.quantity}</td>
                  <td className="py-2 pr-2 tabular-nums">
                    {isPubFee ? "—" : formatPrice(merch)}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{formatPrice(l.platformCutCents)}</td>
                  <td className="max-w-[10rem] truncate py-2 pr-2 text-zinc-400" title={formatBuyerCell(l, "email")}>
                    {formatBuyerCell(l, "email")}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-zinc-400">
                    {formatBuyerShipTo(l)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No matching paid lines, publication fees, or promotions.</p>
      ) : null}

      <AdminClearPlatformSalesForm enabled={clearSalesHistoryEnabled} />
    </section>
  );
}
