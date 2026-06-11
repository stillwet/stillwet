"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminMerchandiseConnectTransferLookup } from "@/actions/admin-platform-sales-connect";
import type { AdminPlatformSalesMergedLine } from "@/lib/admin-platform-sales-merged-line-model";
import {
  isCreatorGiftListingSplitProfitOnlyLine,
  mergedLineApplicationAmountCents,
  mergedLineCheckoutPaidCents,
  mergedLinePaidCogsStripeNetCents,
  mergedLineShopPayoutCents,
  mergedLineStripeBalanceFeeCents,
} from "@/lib/admin-platform-sales-merged-line-model";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";
import { marketplacePlatformFeePercent } from "@/lib/marketplace-fee";
import {
  formatAdminPlatformSalesPrice,
  PlatformRevenueBreakdownTable,
  type PlatformSalesBreakdownRow,
} from "@/components/admin/admin-platform-sales-breakdown";

const SALES_TABLE_EMPTY = "—";

function formatDateMMDDYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}

function formatBuyerShipTo(l: AdminPlatformSalesMergedLine): string {
  if (l.kind !== "merchandise") return SALES_TABLE_EMPTY;
  const country = l.buyer.shippingCountry?.trim().toUpperCase() ?? "";
  const state = l.buyer.shippingState?.trim().toUpperCase() ?? "";
  const isUs = country === "US" || country === "USA" || (!country && state.length > 0);
  if (isUs) return state || SALES_TABLE_EMPTY;
  return country || SALES_TABLE_EMPTY;
}

function formatMergedLineOrderNumber(l: AdminPlatformSalesMergedLine): string {
  const n = l.order.orderNumber;
  if (n == null || !Number.isFinite(n) || n <= 0) return SALES_TABLE_EMPTY;
  return formatBuyerOrderNumberShort(n);
}

function SalesTableCellContent({ value }: { value: string }) {
  if (value === SALES_TABLE_EMPTY) {
    return <span className="text-zinc-600">{SALES_TABLE_EMPTY}</span>;
  }
  return <>{value}</>;
}

function mergedLineDetailRows(
  l: AdminPlatformSalesMergedLine,
  stripeShopTransferCents: number | null,
): PlatformSalesBreakdownRow[] {
  const profitOnlyListingSplit = isCreatorGiftListingSplitProfitOnlyLine(l);
  const rows: PlatformSalesBreakdownRow[] = [];

  if (!profitOnlyListingSplit) {
    rows.push({
      label: "Paid",
      hint:
        l.kind === "merchandise"
          ? "Total amount paid, including tip, and payment processing fee (stripe est. + tip fee)"
          : "Total transaction (promotion + Est. Stripe fee)",
      cents: mergedLineCheckoutPaidCents(l),
    });
  }

  if (!profitOnlyListingSplit && mergedLineStripeBalanceFeeCents(l) > 0) {
    rows.push({
      label: "Stripe fee",
      hint:
        l.kind === "merchandise"
          ? "Stripe balance fee on this row's share of the checkout total (2.9% + 30¢)"
          : "Actual Stripe fee owed",
      hintPosition: "below",
      cents: -mergedLineStripeBalanceFeeCents(l),
    });
  }

  if (l.kind === "merchandise") {
    rows.push({
      label: "Shop payout",
      hint: "Expected Stripe Connect transfer to the shop (merchandise shop cut + tip)",
      cents: -mergedLineShopPayoutCents(l),
    });
    if (
      stripeShopTransferCents != null &&
      stripeShopTransferCents !== mergedLineShopPayoutCents(l)
    ) {
      rows.push({
        label: "Stripe shop transfer",
        hint: "Actual Connect transfer from Stripe (differs from persisted shop cut at checkout)",
        cents: -stripeShopTransferCents,
        mutedValue: true,
      });
    }
    rows.push({
      label: "Application amount",
      hint: "Merchandise platform share (COGS + production fee + platform cut)",
      cents: mergedLineApplicationAmountCents(l),
      subheader: true,
    });
    if (l.goodsServicesCostCents > 0) {
      rows.push({
        label: "COGS",
        hint: "Amount Printify will bill",
        cents: -l.goodsServicesCostCents,
        nested: true,
      });
    }
  }

  if (l.kind === "merchandise" && l.platformCutCents > 0) {
    rows.push({
      label: "10% Cut",
      hint: `${marketplacePlatformFeePercent()}% platform fee on merchandise`,
      cents: l.platformCutCents,
      mutedValue: true,
      nested: true,
    });
  }

  if (l.kind === "merchandise") {
    rows.push({
      label: "Prod Fee",
      hint: "Platform additional fees",
      cents: l.productionFeeCents,
      mutedValue: true,
      nested: true,
    });
  }

  if (l.tipProcessingFeeCents > 0) {
    rows.push({
      label: "Tip Fee",
      hint: "Reference only — not included in application amount",
      cents: l.tipProcessingFeeCents,
      mutedValue: true,
      referenceOnly: true,
    });
  }

  return rows;
}

function mergedLineDetailSection(
  l: AdminPlatformSalesMergedLine,
  stripeShopTransferCents: number | null,
) {
  const isMerchandise = l.kind === "merchandise";
  const rows = mergedLineDetailRows(l, stripeShopTransferCents);
  return {
    sectionTitle: isMerchandise ? "Item Sales - Profit" : "Platform sales - Profit",
    headerTotalCents: mergedLinePaidCogsStripeNetCents(l),
    rows,
  };
}

const SALES_LINE_BREAKDOWN_HINT_CLASS =
  "inline-flex h-3.5 w-3.5 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-600 text-[9px] font-semibold leading-none text-zinc-500 hover:border-zinc-500 hover:text-zinc-300";

/** Base popup width (`w-[15rem]`). */
const SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX = 240;
/** Below this uniform scale, body text (~12px) becomes too small to read. */
const SALES_LINE_BREAKDOWN_MIN_SCALE = 0.75;
const SALES_LINE_BREAKDOWN_VIEWPORT_MARGIN_PX = 8;
const SALES_LINE_BREAKDOWN_PANEL_GAP_PX = 4;

type SalesLineBreakdownPanelFit = {
  scale: number;
  stacked: boolean;
  top: number;
  left: number;
  panelWidthPx: number;
  displayWidthPx: number;
  displayHeightPx: number;
};

function salesLineBreakdownPanelPosition(
  anchor: DOMRect,
  displayHeightPx: number,
  displayWidthPx: number,
): { top: number; left: number } {
  const margin = SALES_LINE_BREAKDOWN_VIEWPORT_MARGIN_PX;
  const gap = SALES_LINE_BREAKDOWN_PANEL_GAP_PX;
  let left = anchor.right + gap;
  if (left + displayWidthPx > window.innerWidth - margin) {
    left = Math.max(margin, anchor.left - displayWidthPx - gap);
  }
  let top = anchor.top;
  if (top + displayHeightPx > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - displayHeightPx - margin);
  }
  top = Math.max(margin, top);
  return { top, left };
}

function measureSalesLineBreakdownPanelFit(
  anchor: DOMRect,
  naturalWidthPx: number,
  naturalHeightPx: number,
  stacked: boolean,
): SalesLineBreakdownPanelFit {
  const margin = SALES_LINE_BREAKDOWN_VIEWPORT_MARGIN_PX;
  const availWidthPx = window.innerWidth - margin * 2;
  const availHeightPx = window.innerHeight - margin * 2;

  if (stacked) {
    const panelWidthPx = Math.min(SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX, availWidthPx);
    const displayHeightPx = naturalHeightPx;
    const { top, left } = salesLineBreakdownPanelPosition(anchor, displayHeightPx, panelWidthPx);
    return {
      scale: 1,
      stacked: true,
      top,
      left,
      panelWidthPx,
      displayWidthPx: panelWidthPx,
      displayHeightPx,
    };
  }

  const scaleToFit = Math.min(
    1,
    availWidthPx / naturalWidthPx,
    availHeightPx / naturalHeightPx,
  );
  const scale = scaleToFit;
  const displayWidthPx = naturalWidthPx * scale;
  const displayHeightPx = naturalHeightPx * scale;
  const { top, left } = salesLineBreakdownPanelPosition(anchor, displayHeightPx, displayWidthPx);

  return {
    scale,
    stacked: false,
    top,
    left,
    panelWidthPx: naturalWidthPx,
    displayWidthPx,
    displayHeightPx,
  };
}

function SalesLineBreakdownHint({
  line,
  open,
  onToggle,
  onClose,
}: {
  line: AdminPlatformSalesMergedLine;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [panelFit, setPanelFit] = useState<SalesLineBreakdownPanelFit>({
    scale: 1,
    stacked: false,
    top: 0,
    left: 0,
    panelWidthPx: SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX,
    displayWidthPx: SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX,
    displayHeightPx: 0,
  });
  const [stripeShopTransferCents, setStripeShopTransferCents] = useState<number | null>(null);
  const detail = mergedLineDetailSection(line, stripeShopTransferCents);

  useEffect(() => {
    if (!open || line.kind !== "merchandise") {
      setStripeShopTransferCents(null);
      return;
    }

    let cancelled = false;
    void adminMerchandiseConnectTransferLookup(
      line.kind === "merchandise" ? line.order.stripePaymentIntentId : null,
    ).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setStripeShopTransferCents(result.stripeShopTransferCents);
      } else {
        setStripeShopTransferCents(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    line.id,
    line.kind,
    line.kind === "merchandise" ? line.order.stripePaymentIntentId : null,
  ]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (innerRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelFit({
        scale: 1,
        stacked: false,
        top: 0,
        left: 0,
        panelWidthPx: SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX,
        displayWidthPx: SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX,
        displayHeightPx: 0,
      });
      return;
    }

    const updateFit = () => {
      if (!triggerRef.current || !innerRef.current) return;
      const anchor = triggerRef.current.getBoundingClientRect();
      const naturalWidthPx = innerRef.current.offsetWidth;
      const naturalHeightPx = innerRef.current.offsetHeight;
      if (naturalWidthPx <= 0 || naturalHeightPx <= 0) return;

      const margin = SALES_LINE_BREAKDOWN_VIEWPORT_MARGIN_PX;
      const availWidthPx = window.innerWidth - margin * 2;
      const availHeightPx = window.innerHeight - margin * 2;

      setPanelFit((prev) => {
        let stacked = prev.stacked;
        if (!stacked) {
          const scaleToFit = Math.min(
            1,
            availWidthPx / naturalWidthPx,
            availHeightPx / naturalHeightPx,
          );
          if (scaleToFit < SALES_LINE_BREAKDOWN_MIN_SCALE) {
            stacked = true;
          }
        }

        const next = measureSalesLineBreakdownPanelFit(
          anchor,
          naturalWidthPx,
          naturalHeightPx,
          stacked,
        );

        if (
          prev.scale === next.scale &&
          prev.stacked === next.stacked &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.panelWidthPx === next.panelWidthPx &&
          prev.displayWidthPx === next.displayWidthPx &&
          prev.displayHeightPx === next.displayHeightPx
        ) {
          return prev;
        }
        return next;
      });
    };

    updateFit();
    const raf = requestAnimationFrame(updateFit);

    window.addEventListener("scroll", updateFit, true);
    window.addEventListener("resize", updateFit);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateFit, true);
      window.removeEventListener("resize", updateFit);
    };
  }, [open, line.id, panelFit.stacked, stripeShopTransferCents]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`platform-sales-detail-${line.id}`}
        aria-label={`${detail.sectionTitle} breakdown`}
        className={SALES_LINE_BREAKDOWN_HINT_CLASS}
      >
        ?
      </button>
      {open ? (
        <div
          id={`platform-sales-detail-${line.id}`}
          className="pointer-events-none fixed z-[100]"
          style={{
            top: panelFit.top,
            left: panelFit.left,
            width: panelFit.displayWidthPx,
            height: panelFit.stacked ? undefined : panelFit.displayHeightPx,
          }}
        >
          <div
            ref={innerRef}
            className="pointer-events-auto origin-top-left overflow-visible rounded-md bg-zinc-950 shadow-lg"
            style={{
              width: panelFit.stacked ? panelFit.panelWidthPx : SALES_LINE_BREAKDOWN_PANEL_WIDTH_PX,
              transform: panelFit.stacked ? undefined : `scale(${panelFit.scale})`,
            }}
          >
            <PlatformRevenueBreakdownTable
              solidBackground
              layout={panelFit.stacked ? "stacked" : "table"}
              tone={line.kind === "merchandise" ? "shop" : "platform"}
              sectionTitle={detail.sectionTitle}
              headerTotalCents={detail.headerTotalCents}
              rows={detail.rows}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AdminPlatformSalesLinesTable({ lines }: { lines: AdminPlatformSalesMergedLine[] }) {
  const [openLineId, setOpenLineId] = useState<string | null>(null);

  return (
    <div className="mt-4 min-w-0 overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col />
          <col className="w-[7%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500">
            <th className="overflow-hidden px-1 py-2 text-center font-medium">Date</th>
            <th className="overflow-hidden px-1 py-2 text-center font-medium">Order</th>
            <th className="overflow-hidden px-1 py-2 text-center font-medium text-blue-400/90">
              Platform profit
            </th>
            <th className="overflow-hidden px-1 py-2 text-center font-medium">Details</th>
            <th className="overflow-hidden py-2 pl-4 pr-1 text-left font-medium">Item</th>
            <th className="overflow-hidden px-1 py-2 text-center font-medium">Qty</th>
            <th className="overflow-hidden px-1 py-2 text-center font-medium">Ship-to</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-zinc-900 text-zinc-300">
              <td className="overflow-hidden px-1 py-2 text-center font-mono text-[10px] text-zinc-500">
                {formatDateMMDDYY(l.order.createdAt)}
              </td>
              <td className="overflow-hidden px-1 py-2 text-center font-mono text-[10px] tabular-nums text-zinc-400">
                <SalesTableCellContent value={formatMergedLineOrderNumber(l)} />
              </td>
              <td className="overflow-hidden whitespace-nowrap px-1 py-2 text-center tabular-nums">
                {formatAdminPlatformSalesPrice(mergedLinePaidCogsStripeNetCents(l))}
              </td>
              <td className="overflow-visible px-1 py-2 text-center">
                <SalesLineBreakdownHint
                  line={l}
                  open={openLineId === l.id}
                  onToggle={() => setOpenLineId((prev) => (prev === l.id ? null : l.id))}
                  onClose={() => setOpenLineId(null)}
                />
              </td>
              <td className="overflow-hidden py-2 pl-4 pr-1" title={l.productName}>
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
              <td className="overflow-hidden px-1 py-2 text-center tabular-nums text-zinc-400">
                {l.quantity}
              </td>
              <td className="overflow-hidden px-1 py-2 text-center font-mono text-[10px] text-zinc-400">
                <span className="block truncate">
                  <SalesTableCellContent value={formatBuyerShipTo(l)} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
