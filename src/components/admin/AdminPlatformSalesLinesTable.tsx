"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AdminPlatformSalesMergedLine } from "@/lib/admin-platform-sales-merged-line-model";
import { mergedLineCheckoutPaidCents, mergedLinePaidCogsStripeNetCents, mergedLineStripeBalanceFeeCents } from "@/lib/admin-platform-sales-merged-line-model";
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

function mergedLineDetailRows(l: AdminPlatformSalesMergedLine): PlatformSalesBreakdownRow[] {
  const rows: PlatformSalesBreakdownRow[] = [
    {
      label: "Paid",
      hint:
        l.kind === "merchandise"
          ? "Total amount paid, including tip, and payment processing fee (stripe est. + tip fee)"
          : "Total transaction (promotion + Est. Stripe fee)",
      cents: mergedLineCheckoutPaidCents(l),
    },
  ];

  if (l.kind === "merchandise") {
    rows.push({ label: "Shop cut", cents: -l.shopCutCents });
    if (l.goodsServicesCostCents > 0) {
      rows.push({
        label: "COGS",
        hint: "Printify item cost + shipping cost",
        cents: -l.goodsServicesCostCents,
      });
    }
  }

  if (mergedLineStripeBalanceFeeCents(l) > 0) {
    rows.push({
      label: "Stripe fee",
      hint:
        l.kind === "merchandise"
          ? "Stripe balance fee on this row's share of the checkout total (2.9% + 30¢)"
          : "Actual Stripe fee owed",
      hintPosition: l.kind === "merchandise" ? "below" : "above",
      cents: -mergedLineStripeBalanceFeeCents(l),
    });
  }

  if (l.kind === "merchandise" && l.platformCutCents > 0) {
    rows.push({
      label: "10% Cut",
      hint: `${marketplacePlatformFeePercent()}% platform fee on merchandise`,
      cents: l.platformCutCents,
      mutedValue: true,
    });
  }

  if (l.kind === "merchandise") {
    rows.push({
      label: "Prod Fee",
      hint: "Printify production fee per item",
      cents: l.productionFeeCents,
      mutedValue: true,
    });
  }

  if (l.tipProcessingFeeCents > 0) {
    rows.push({
      label: "Tip Fee",
      hint: "25¢ platform surcharge if tipped",
      cents: l.tipProcessingFeeCents,
      mutedValue: true,
    });
  }

  return rows;
}

function mergedLineDetailSection(l: AdminPlatformSalesMergedLine) {
  const isMerchandise = l.kind === "merchandise";
  const rows = mergedLineDetailRows(l);
  return {
    sectionTitle: isMerchandise ? "Shop sales - Profit" : "Platform sales - Profit",
    headerTotalCents: mergedLinePaidCogsStripeNetCents(l),
    rows,
  };
}

const SALES_LINE_BREAKDOWN_HINT_CLASS =
  "inline-flex h-3.5 w-3.5 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-600 text-[9px] font-semibold leading-none text-zinc-500 hover:border-zinc-500 hover:text-zinc-300";

function salesLineBreakdownPanelPosition(
  anchor: DOMRect,
  panelHeight: number,
  panelWidth: number,
) {
  const gap = 4;
  const margin = 8;
  let left = anchor.right + gap;
  if (left + panelWidth > window.innerWidth - margin) {
    left = Math.max(margin, anchor.left - panelWidth - gap);
  }
  let top = anchor.top;
  if (top + panelHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - panelHeight - margin);
  }
  top = Math.max(margin, top);
  return { top, left };
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const detail = mergedLineDetailSection(line);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = panelRef.current?.offsetWidth ?? Math.min(288, window.innerWidth - 16);
      const height = panelRef.current?.offsetHeight ?? 160;
      setPosition(salesLineBreakdownPanelPosition(rect, height, width));
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, line.id]);

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
          ref={panelRef}
          id={`platform-sales-detail-${line.id}`}
          className="fixed z-[100] w-[15rem] max-w-[calc(100vw-1rem)] overflow-visible rounded-md bg-zinc-950 shadow-lg"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          <PlatformRevenueBreakdownTable
            solidBackground
            sectionTitle={detail.sectionTitle}
            headerTotalCents={detail.headerTotalCents}
            rows={detail.rows}
          />
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
            <th className="overflow-hidden px-1 py-2 text-center font-medium">Platform profit</th>
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
