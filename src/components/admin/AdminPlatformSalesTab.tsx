import Link from "next/link";
import type {
  AdminPlatformSalesMergedLine,
  PlatformSalesMonthlyAverageSummary,
  PlatformSalesPeriodTotals,
  PlatformSalesYtdTotals,
} from "@/lib/admin-platform-sales-merged-lines";
import {
  mergedLineTransactionPartyLabel,
  periodApplicationAmountCents,
  periodShopPayoutCents,
  shopSalesPaidCogsStripeNetCents,
} from "@/lib/admin-platform-sales-merged-lines";
import { mergedLineDetailsExport } from "@/lib/admin-platform-sales-merged-line-model";
import { AdminClearPlatformSalesForm } from "@/components/admin/AdminClearPlatformSalesForm";
import { AdminPlatformSalesLinesTable } from "@/components/admin/AdminPlatformSalesLinesTable";
import {
  formatAdminPlatformSalesPrice,
  PlatformRevenueBreakdownTable,
} from "@/components/admin/admin-platform-sales-breakdown";
import { marketplacePlatformFeePercent } from "@/lib/marketplace-fee";

function formatPrice(cents: number) {
  return formatAdminPlatformSalesPrice(cents);
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
  /** Shop sales breakdown header total (Paid − Shop cut − COGS − Stripe fee). */
  const itemSalesCutHeaderCents = shopSalesPaidCogsStripeNetCents(totals);
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
              tone="shop"
              sectionTitle="Item Sales - Profit"
              headerTotalCents={itemSalesCutHeaderCents}
              rows={[
                {
                  label: "Paid",
                  hint: "Total amount paid, including tip, and payment processing fee (stripe est. + tip fee)",
                  cents: totals.itemCheckoutPaidCents,
                },
                {
                  label: "Stripe fee",
                  hint: "Stripe balance fee on item checkouts (2.9% + 30¢ on full charge, rounded).",
                  hintPosition: "below",
                  cents: -totals.shopSalesPaymentProcessingCents,
                },
                {
                  label: "Shop payout",
                  hint: "Creator shop merchandise profit + tip",
                  cents: -periodShopPayoutCents(totals),
                },
                {
                  label: "Application amount",
                  hint: "COGS + production fee + platform cut + buyer Stripe payment-processing pass-through",
                  cents: periodApplicationAmountCents(totals),
                  subheader: true,
                },
                {
                  label: "COGS",
                  hint: "Amount Printify will bill",
                  cents: -totals.itemGoodsServicesCents,
                  nested: true,
                },
                {
                  label: "10% Cut",
                  hint: `${marketplacePlatformFeePercent()}% platform fee on merchandise`,
                  cents: totals.itemPlatformCents,
                  mutedValue: true,
                  nested: true,
                },
                {
                  label: "Prod Fee",
                  hint: "Platform additional fees",
                  cents: totals.itemProductionFeeCents,
                  mutedValue: true,
                  nested: true,
                },
                {
                  label: "Tip processing",
                  hint: "Reference only — not included in application amount",
                  cents: totals.cartTipPlatformCents,
                  mutedValue: true,
                  referenceOnly: true,
                },
              ]}
            />
            <PlatformRevenueBreakdownTable
              subtle={subtle}
              tone="platform"
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
              ]}
            />
          </div>
        </details>
      </dl>
    </div>
  );
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

function formatBuyerShipTo(l: AdminPlatformSalesMergedLine): string {
  if (l.kind !== "merchandise") return "—";
  const country = l.buyer.shippingCountry?.trim().toUpperCase() ?? "";
  const state = l.buyer.shippingState?.trim().toUpperCase() ?? "";
  const isUs = country === "US" || country === "USA" || (!country && state.length > 0);
  if (isUs) return state || "—";
  return country || "—";
}

export function AdminPlatformSalesTab(props: {
  lines: AdminPlatformSalesMergedLine[];
  salesFromValue: string;
  salesToValue: string;
  salesKind: "all" | "listing" | "item" | "support" | "promotion" | "shop_creation";
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
      const shopName = l.shop?.displayName ?? "";
      const shopSlug = l.shop?.slug ?? "";
      const transactionParty = mergedLineTransactionPartyLabel(l);
      const transactionPartyCsv = transactionParty === "—" ? "" : transactionParty;
      const buyerShipTo = l.kind === "merchandise" ? formatBuyerShipTo(l) : "";
      const buyerShipToCsv = buyerShipTo === "—" ? "" : buyerShipTo;
      const orderNumber =
        l.order.orderNumber != null && Number.isFinite(l.order.orderNumber) && l.order.orderNumber > 0
          ? String(l.order.orderNumber)
          : "";
      const details = mergedLineDetailsExport(l);
      return [
        l.order.createdAt.toISOString(),
        orderNumber,
        l.order.id,
        l.productName,
        String(l.quantity),
        String(details.platformProfitCents),
        String(details.paidCents),
        String(details.shopCutCents),
        String(details.cogsCents),
        String(details.stripeBalanceFeeCents),
        String(details.platformCutCents),
        String(details.productionFeeCents),
        String(details.tipProcessingFeeCents),
        shopName,
        shopSlug,
        transactionPartyCsv,
        buyerShipToCsv,
      ]
        .map((c) => escapeCsvCell(c))
        .join(",");
    })
    .join("\n");
  const csv =
    "date,order_number,order_id,item,qty,platform_profit_cents,paid_cents,shop_cut_cents,cogs_cents,stripe_balance_fee_cents,platform_cut_cents,production_fee_cents,tip_processing_fee_cents,shop_name,shop_slug,buyer,buyer_ship_to\n" +
    csvBody;
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  const kindHref = (k: "all" | "listing" | "item" | "support" | "promotion" | "shop_creation") =>
    buildSalesTabHref({
      salesFrom: salesFromValue,
      salesTo: salesToValue,
      salesKind: k === "all" ? undefined : k,
    });

  const kindBtn = (
    k: "all" | "listing" | "item" | "support" | "promotion" | "shop_creation",
    label: string,
  ) => {
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
      <h2 className="text-sm font-medium uppercase tracking-wide text-blue-400/90">Platform sales</h2>

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
        {kindBtn("shop_creation", "Shop creation")}
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
        Checkout totals are pre–sales-tax. Use Details on each row for Paid, fees, and profit breakdown.
        CSV export includes the same per-row details columns (platform profit, paid, shop cut, COGS, Stripe fee, and fee lines).
      </p>

      <AdminPlatformSalesLinesTable lines={lines} />
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No matching platform or shop transactions.</p>
      ) : null}

      <AdminClearPlatformSalesForm enabled={clearSalesHistoryEnabled} />
    </section>
  );
}
