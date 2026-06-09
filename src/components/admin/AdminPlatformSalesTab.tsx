import Link from "next/link";
import type {
  AdminPlatformSalesBuyer,
  AdminPlatformSalesMergedLine,
  PlatformSalesMonthlyAverageSummary,
  PlatformSalesPeriodTotals,
  PlatformSalesYtdTotals,
} from "@/lib/admin-platform-sales-merged-lines";
import { AdminClearPlatformSalesForm } from "@/components/admin/AdminClearPlatformSalesForm";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";
import { marketplacePlatformFeePercent } from "@/lib/marketplace-fee";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function BreakdownLabelHint({
  label,
  hint,
  hintPosition = "below",
}: {
  label: string;
  hint: string;
  hintPosition?: "above" | "below";
}) {
  const hintClass =
    hintPosition === "above"
      ? "absolute bottom-full left-0 z-20 mb-1 w-max max-w-[14rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg"
      : "absolute left-0 top-full z-20 mt-1 w-max max-w-[14rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg";

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <details className="relative inline-block">
        <summary
          className="inline-flex h-3.5 w-3.5 cursor-help list-none items-center justify-center rounded-full border border-zinc-600 text-[9px] font-semibold leading-none text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden"
          aria-label={`About ${label}`}
        >
          ?
        </summary>
        <p className={hintClass}>{hint}</p>
      </details>
    </span>
  );
}

function PlatformRevenueBreakdownTable({
  subtle,
  sectionTitle,
  headerTotalCents,
  rows,
}: {
  subtle: boolean;
  sectionTitle: string;
  headerTotalCents?: number;
  rows: { label: string; cents: number; emphasize?: boolean; hint?: string; hintPosition?: "above" | "below" }[];
}) {
  const wrapClass = subtle
    ? "overflow-hidden rounded-md border border-zinc-800/40"
    : "overflow-hidden rounded-md border border-zinc-800/70";
  const headerWrapClass = subtle
    ? "border-b border-blue-500/25 bg-blue-950/20 px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
    : "border-b border-blue-500/45 bg-blue-950/35 px-2 py-1 text-[10px] font-medium uppercase tracking-wide";
  const headerTitleClass = subtle ? "text-blue-400/55" : "text-blue-400/90";
  const headerTotalClass = subtle ? "tabular-nums text-blue-200/75" : "tabular-nums text-blue-100";
  const labelClass = subtle
    ? "text-[10px] uppercase tracking-wide text-zinc-600"
    : "text-[10px] uppercase tracking-wide text-zinc-600";
  const valueClass = subtle ? "tabular-nums text-zinc-400" : "tabular-nums text-zinc-200";
  const rowBorder = subtle ? "border-zinc-800/35" : "border-zinc-800/50";
  const emphasizeRow = subtle ? "bg-zinc-950/25" : "bg-zinc-950/40";

  return (
    <div className={wrapClass}>
      <div className={`${headerWrapClass} flex items-baseline justify-between gap-2`}>
        <span className={headerTitleClass}>{sectionTitle}</span>
        {headerTotalCents != null ? (
          <span className={headerTotalClass}>{formatPrice(headerTotalCents)}</span>
        ) : null}
      </div>
      <table className="w-full border-collapse text-xs">
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`border-b ${rowBorder} last:border-b-0 ${row.emphasize ? emphasizeRow : ""}`}
            >
              <td className={`px-2 py-1.5 ${labelClass}`}>
                {row.hint ? (
                  <BreakdownLabelHint
                    label={row.label}
                    hint={row.hint}
                    hintPosition={row.hintPosition}
                  />
                ) : (
                  row.label
                )}
              </td>
              <td className={`px-2 py-1.5 text-right ${valueClass}`}>{formatPrice(row.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlatformRevenueTotalsCard({
  title,
  subtitle,
  totals,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  totals: PlatformSalesPeriodTotals;
  tone?: "default" | "subtle";
}) {
  const ancillaryPlatformCents =
    totals.shopCreationPlatformCents +
    totals.listingPlatformCents +
    totals.promotionPlatformCents +
    totals.supportPlatformCents -
    totals.platformSalesPaymentProcessingCents;
  /** Expand breakdown: COGS and Stripe fees are platform charges, not revenue. */
  const itemSalesCutHeaderCents =
    totals.itemPlatformCents -
    totals.itemGoodsServicesCents +
    totals.itemProductionFeeCents +
    totals.cartTipPlatformCents -
    totals.shopSalesPaymentProcessingCents;
  const combined = itemSalesCutHeaderCents + ancillaryPlatformCents;
  const subtle = tone === "subtle";
  const cardClass = subtle
    ? "rounded-lg border border-zinc-800/35 bg-zinc-950/15 px-3 py-3 text-xs"
    : "rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-3 text-xs";
  const titleClass = subtle
    ? "font-medium uppercase tracking-wide text-zinc-600"
    : "font-medium uppercase tracking-wide text-zinc-500";
  const subtitleClass = subtle ? "mt-0.5 text-[10px] text-zinc-600" : "mt-0.5 text-[10px] text-zinc-500";
  const combinedWrap = subtle
    ? "rounded-md border border-blue-500/25 bg-blue-950/20 px-2 py-1.5"
    : "rounded-md border border-blue-500/45 bg-blue-950/35 px-2 py-1.5";
  const combinedDt = subtle
    ? "text-[10px] uppercase tracking-wide text-blue-400/55"
    : "text-[10px] uppercase tracking-wide text-blue-400/90";
  const combinedDd = subtle ? "tabular-nums text-blue-200/75" : "tabular-nums text-blue-100";
  const expandSummaryClass = subtle
    ? "cursor-pointer select-none list-none py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600 hover:text-zinc-400 [&::-webkit-details-marker]:hidden"
    : "cursor-pointer select-none list-none py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden";
  return (
    <div className={cardClass}>
      <p className={titleClass}>{title}</p>
      {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
      <dl className="mt-2">
        <div className={`${combinedWrap} flex items-baseline justify-between gap-2`}>
          <dt className={combinedDt}>Actual profit</dt>
          <dd className={`${combinedDd} m-0`}>{formatPrice(combined)}</dd>
        </div>
        <details className="mt-2">
          <summary className={expandSummaryClass}>Expand</summary>
          <div className="mt-2 space-y-2">
            <PlatformRevenueBreakdownTable
              subtle={subtle}
              sectionTitle="Shop sales - Profit"
              headerTotalCents={itemSalesCutHeaderCents}
              rows={[
                {
                  label: "Cost of sale",
                  hint: "Total buyer merchandise charged on purchased items (excludes tips and Stripe fees; before platform, COGS, and production fee splits).",
                  cents: totals.itemMerchandiseSoldCents,
                },
                {
                  label: "Platform cut",
                  hint: `Production cost + ${marketplacePlatformFeePercent()}% platform fee`,
                  cents: totals.itemPlatformCents + totals.itemProductionFeeCents,
                },
                {
                  label: "Tip fees",
                  hint: "25¢ platform surcharge on buyer cart tips",
                  cents: totals.cartTipPlatformCents,
                },
                { label: "COGS", cents: -totals.itemGoodsServicesCents },
                {
                  label: "Stripe fees",
                  hint: "Stripe pass-through on buyer item checkouts only (merchandise, shipping, and cart tips). Excludes shop setup, listings, promotions, and other platform checkouts.",
                  hintPosition: "above",
                  cents: -totals.shopSalesPaymentProcessingCents,
                },
              ]}
            />
            <PlatformRevenueBreakdownTable
              subtle={subtle}
              sectionTitle="Platform sales - Profit"
              headerTotalCents={ancillaryPlatformCents}
              rows={[
                {
                  label: "Shop creation",
                  hint: "Shop setup fees and inactivity reactivation fees paid at checkout (self signup, setup gift, or reactivation).",
                  cents: totals.shopCreationPlatformCents,
                },
                {
                  label: "Listings",
                  hint: "Listing credit packs bought on shop upgrades and gifted listing credits",
                  cents: totals.listingPlatformCents,
                },
                {
                  label: "Promotions",
                  hint: "Other shop upgrades — paid placements, flair, Google Shopping, and gifted upgrade credits. New upgrade checkouts (except listing credits) belong here — see admin-platform-shop-upgrades-revenue.ts.",
                  cents: totals.promotionPlatformCents,
                },
                { label: "Support <3", cents: totals.supportPlatformCents },
                {
                  label: "Stripe fees",
                  hint: "Stripe pass-through on platform checkouts only (shop setup, reactivation, shop upgrades, support donations, and gifted platform purchases). Excludes buyer item purchases and cart tips on item checkouts.",
                  hintPosition: "above",
                  cents: -totals.platformSalesPaymentProcessingCents,
                },
              ]}
            />
          </div>
        </details>
      </dl>
    </div>
  );
}

/** Local calendar date for table display (e.g. `04/25/26`). */
function formatDateMMDDYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
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

function linePlatformCutCents(l: AdminPlatformSalesMergedLine, includeProductionFee: boolean): number {
  return l.platformCutCents + (includeProductionFee ? l.productionFeeCents : 0);
}

export function AdminPlatformSalesTab(props: {
  lines: AdminPlatformSalesMergedLine[];
  salesFromValue: string;
  salesToValue: string;
  salesKind: "all" | "listing" | "item" | "support" | "promotion";
  monthSummaries: {
    currentMonthTitle: string;
    currentQuarterTitle: string;
    currentTotals: PlatformSalesPeriodTotals;
    currentQuarterTotals: PlatformSalesPeriodTotals;
    ytdTotals: PlatformSalesYtdTotals;
    monthlyAverage: PlatformSalesMonthlyAverageSummary;
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
      const isMerchLine = l.kind === "merchandise";
      return [
        l.order.createdAt.toISOString(),
        orderNumber,
        l.order.id,
        l.productName,
        String(l.quantity),
        String(merch),
        String(l.goodsServicesCostCents),
        String(l.stripeFeeCents),
        String(linePlatformCutCents(l, isMerchLine)),
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
    "date,order_number,order_id,item,qty,merchandise_cents,cogs_cents,stripe_fee_cents,platform_cut_cents,shop_cut_cents,shop_name,shop_slug,buyer_email,buyer_ship_to\n" +
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
            <PlatformRevenueTotalsCard title={monthSummaries.currentMonthTitle} totals={monthSummaries.currentTotals} />
            <PlatformRevenueTotalsCard
              title={`YTD ${monthSummaries.ytdTotals.year}`}
              totals={monthSummaries.ytdTotals}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <PlatformRevenueTotalsCard
              tone="subtle"
              title="Monthly average"
              totals={monthSummaries.monthlyAverage.totals}
            />
            <PlatformRevenueTotalsCard
              tone="subtle"
              title={monthSummaries.currentQuarterTitle}
              totals={monthSummaries.currentQuarterTotals}
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

      <div className="mt-4 min-w-0">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[16%]" />
            <col className="w-[4%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[20%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="overflow-hidden px-1 py-2 text-center font-medium">Date</th>
              <th className="overflow-hidden px-1 py-2 text-center font-medium">Order</th>
              <th className="overflow-hidden px-1 py-2 text-left font-medium">Item</th>
              <th className="overflow-hidden px-1 py-2 text-center font-medium">Qty</th>
              <th className="overflow-hidden px-1 py-2 text-center font-medium">Merch</th>
              <th className="overflow-hidden px-1 py-2 text-center font-medium">G/S</th>
              <th className="overflow-hidden whitespace-nowrap px-1 py-2 text-center text-[10px] font-medium">
                Stripe fee
              </th>
              <th className="overflow-hidden whitespace-nowrap px-1 py-2 text-center text-[10px] font-medium">
                Platform cut
              </th>
              <th className="overflow-hidden px-1 py-2 text-center font-medium">Shop cut</th>
              <th className="overflow-hidden px-1 py-2 text-left font-medium">Buyer email</th>
              <th className="overflow-hidden px-1 py-2 text-center font-medium">Ship-to</th>
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
                  <td className="overflow-hidden px-1 py-2 text-center font-mono text-[10px] text-zinc-500">
                    {formatDateMMDDYY(l.order.createdAt)}
                  </td>
                  <td className="overflow-hidden px-1 py-2 text-center font-mono text-[10px] tabular-nums text-zinc-400">
                    {formatMerchandiseOrderNumber(l)}
                  </td>
                  <td className="overflow-hidden px-1 py-2" title={l.productName}>
                    {l.itemHref ? (
                      <Link
                        href={l.itemHref}
                        className="block truncate text-zinc-300 hover:text-blue-300 hover:underline"
                      >
                        {l.productName}
                      </Link>
                    ) : (
                      <span className="block truncate">{l.productName}</span>
                    )}
                  </td>
                  <td className="overflow-hidden px-1 py-2 text-center tabular-nums">{l.quantity}</td>
                  <td className="overflow-hidden whitespace-nowrap px-1 py-2 text-center tabular-nums">
                    {isPubFee ? "—" : formatPrice(merch)}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-1 py-2 text-center tabular-nums">
                    {isPubFee ? "—" : formatPrice(l.goodsServicesCostCents)}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-1 py-2 text-center tabular-nums">
                    {l.stripeFeeCents > 0 ? formatPrice(l.stripeFeeCents) : "—"}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-1 py-2 text-center tabular-nums">
                    {formatPrice(linePlatformCutCents(l, !isPubFee))}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-1 py-2 text-center tabular-nums">
                    {formatPrice(l.shopCutCents)}
                  </td>
                  <td className="overflow-hidden px-1 py-2 text-zinc-400" title={formatBuyerCell(l, "email")}>
                    <span className="block truncate">{formatBuyerCell(l, "email")}</span>
                  </td>
                  <td className="overflow-hidden px-1 py-2 text-center font-mono text-[10px] text-zinc-400">
                    <span className="block truncate">{formatBuyerShipTo(l)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No matching paid lines, listing credits, or promotions.</p>
      ) : null}

      <AdminClearPlatformSalesForm enabled={clearSalesHistoryEnabled} />
    </section>
  );
}
