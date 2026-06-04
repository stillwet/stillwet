"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { adminSaveNexusRegistrationDate } from "@/actions/admin-nexus-registration-dates";
import type { AdminNexusDestinationRow, AdminNexusPlanningSnapshot } from "@/lib/admin-nexus-planning-load";
import type { AdminNexusRegistrationDatesByCode } from "@/lib/admin-nexus-registration-dates";
import {
  intlEconomicNexusDollarLabel,
  intlEconomicNexusSalesThresholdUsdCents,
  intlEconomicNexusTransactionLabel,
  intlEconomicNexusTransactionThreshold,
} from "@/lib/intl-economic-nexus-thresholds";
import {
  usEconomicNexusDollarLabel,
  usEconomicNexusSalesThresholdCents,
  usEconomicNexusTransactionLabel,
  usEconomicNexusTransactionThreshold,
  US_STATES_WITHOUT_SALES_TAX,
} from "@/lib/us-economic-nexus-thresholds";
import {
  isSalesTaxRegistrationRenewalWithinDays,
  isSubduedRegistrationRenewalLabel,
  usSalesTaxRegistrationCostLabel,
  usSalesTaxRegistrationRenewalLabel,
} from "@/lib/us-sales-tax-registration-costs";

/** Warn when permit renewal is due within this many days (uses Registered date). */
const NEXUS_RENEWAL_NEAR_DAYS = 60;

/** Warn when this many orders below the transaction nexus threshold. */
const NEXUS_NEAR_SALES = 10;
/** Warn when merchandise is within this many cents below the dollar nexus threshold ($400). */
const NEXUS_NEAR_DOLLAR_CENTS = 40_000;

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function dollarNexusLabel(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): string {
  if (variant === "intl") return intlEconomicNexusDollarLabel(row.code);
  if (variant === "missing") return "—";
  return usEconomicNexusDollarLabel(row.code);
}

function transactionNexusLabel(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): string {
  if (variant === "intl") return intlEconomicNexusTransactionLabel(row.code);
  if (variant === "missing") return "—";
  return usEconomicNexusTransactionLabel(row.code);
}

function registrationCostLabel(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): string {
  if (variant !== "us") return "—";
  return usSalesTaxRegistrationCostLabel(row.code);
}

function registrationRenewalLabel(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): string {
  if (variant !== "us") return "—";
  return usSalesTaxRegistrationRenewalLabel(row.code);
}

function saleAmountMeetsDollarNexus(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): boolean {
  if (variant === "intl") {
    const threshold = intlEconomicNexusSalesThresholdUsdCents(row.code);
    if (threshold == null) return false;
    if (threshold === 0) return row.merchandiseCents > 0;
    return row.merchandiseCents >= threshold;
  }
  if (variant !== "us") return false;
  const threshold = usEconomicNexusSalesThresholdCents(row.code);
  if (threshold == null) return false;
  return row.merchandiseCents >= threshold;
}

function orderCountMeetsTransactionNexus(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): boolean {
  const threshold =
    variant === "intl"
      ? intlEconomicNexusTransactionThreshold(row.code)
      : variant === "us"
        ? usEconomicNexusTransactionThreshold(row.code)
        : null;
  if (threshold == null) return false;
  return row.orderCount >= threshold;
}

function dollarNexusThresholdCents(
  row: AdminNexusDestinationRow,
  variant: "us" | "intl" | "missing",
): number | null {
  if (variant === "intl") return intlEconomicNexusSalesThresholdUsdCents(row.code);
  if (variant === "us") return usEconomicNexusSalesThresholdCents(row.code);
  return null;
}

function amountUntilDollarNexusCents(
  row: AdminNexusDestinationRow,
  variant: "us" | "intl" | "missing",
): number | null {
  const threshold = dollarNexusThresholdCents(row, variant);
  if (threshold == null) return null;
  return Math.max(0, threshold - row.merchandiseCents);
}

function amountUntilDollarNexusLabel(
  row: AdminNexusDestinationRow,
  variant: "us" | "intl" | "missing",
): string {
  const remaining = amountUntilDollarNexusCents(row, variant);
  if (remaining == null) return "—";
  return formatPrice(remaining);
}

function amountUntilSaleNexusCount(
  row: AdminNexusDestinationRow,
  variant: "us" | "intl" | "missing",
): number | null {
  const threshold = transactionNexusThresholdCount(row, variant);
  if (threshold == null) return null;
  return Math.max(0, threshold - row.orderCount);
}

function amountUntilNexusContent(
  row: AdminNexusDestinationRow,
  variant: "us" | "intl" | "missing",
) {
  const dollarPart = amountUntilDollarNexusLabel(row, variant);
  const salesRemaining = amountUntilSaleNexusCount(row, variant);
  const mutedDash = <span className={NEXUS_SUBDUED_TEXT}>—</span>;

  if (dollarPart === "—" && salesRemaining == null) return mutedDash;
  if (salesRemaining == null) return dollarPart;
  if (salesRemaining === 0) {
    if (dollarPart === "—") return mutedDash;
    return (
      <>
        {dollarPart} / {mutedDash}
      </>
    );
  }
  if (dollarPart === "—") return String(salesRemaining);
  return `${dollarPart} / ${salesRemaining}`;
}

function transactionNexusThresholdCount(
  row: AdminNexusDestinationRow,
  variant: "us" | "intl" | "missing",
): number | null {
  if (variant === "intl") return intlEconomicNexusTransactionThreshold(row.code);
  if (variant === "us") return usEconomicNexusTransactionThreshold(row.code);
  return null;
}

function isNearDollarNexus(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): boolean {
  const threshold = dollarNexusThresholdCents(row, variant);
  if (threshold == null || threshold <= 0) return false;
  if (row.merchandiseCents >= threshold) return false;
  return threshold - row.merchandiseCents <= NEXUS_NEAR_DOLLAR_CENTS;
}

function isNearTransactionNexus(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): boolean {
  const threshold = transactionNexusThresholdCount(row, variant);
  if (threshold == null) return false;
  if (row.orderCount >= threshold) return false;
  return threshold - row.orderCount <= NEXUS_NEAR_SALES;
}

function isNearNexusThreshold(row: AdminNexusDestinationRow, variant: "us" | "intl" | "missing"): boolean {
  return isNearDollarNexus(row, variant) || isNearTransactionNexus(row, variant);
}

function partitionUsStates(rows: AdminNexusDestinationRow[]) {
  const noTax = new Set(US_STATES_WITHOUT_SALES_TAX);
  const withSalesTax: AdminNexusDestinationRow[] = [];
  const withoutSalesTax: AdminNexusDestinationRow[] = [];
  for (const row of rows) {
    if (noTax.has(row.code)) {
      withoutSalesTax.push(row);
    } else {
      withSalesTax.push(row);
    }
  }
  return { withSalesTax, withoutSalesTax };
}

function NexusTableColGroup() {
  return (
    <colgroup>
      <col className="w-[4.5rem]" />
      <col className="w-[4.25rem]" />
      <col className="w-[6.75rem]" />
      <col className="w-[7.5rem]" />
      <col className="w-[6.5rem]" />
      <col className="w-[4.25rem]" />
      <col className="w-[4.75rem]" />
      <col className="w-[5rem]" />
      <col className="w-[5.75rem]" />
    </colgroup>
  );
}

const NEXUS_TABLE_CLASS =
  "w-full min-w-[880px] table-fixed border-collapse text-center text-xs";

const NEXUS_AMOUNT_UNTIL_DIVIDER = "border-l border-r border-zinc-800";

const NEXUS_CELL = "px-2 py-2";

const NEXUS_SUBDUED_TEXT = "text-zinc-800";

type RegisteredDateSaveState = {
  code: string;
  status: "pending" | "saved" | "error";
  error?: string;
};

function DestinationTable(props: {
  title: string;
  codeLabel: string;
  rows: AdminNexusDestinationRow[];
  emptyMessage: string;
  variant: "us" | "intl" | "missing";
  registrationDatesByCode: AdminNexusRegistrationDatesByCode;
  onRegisteredDateChange: (code: string, isoDate: string) => void;
  onRegisteredDateClear: (code: string) => void;
  registeredDateSaveState: RegisteredDateSaveState | null;
}) {
  const {
    title,
    codeLabel,
    rows,
    emptyMessage,
    variant,
    registrationDatesByCode,
    onRegisteredDateChange,
    onRegisteredDateClear,
    registeredDateSaveState,
  } = props;

  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">{emptyMessage}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className={NEXUS_TABLE_CLASS}>
            <NexusTableColGroup />
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className={`${NEXUS_CELL} font-medium`}>{codeLabel}</th>
                <th className={`${NEXUS_CELL} font-medium`}>Orders</th>
                <th className={`${NEXUS_CELL} font-medium`}>Sale Amount</th>
                <th className={`${NEXUS_CELL} font-medium ${NEXUS_AMOUNT_UNTIL_DIVIDER}`}>Amount until nexus</th>
                <th className={`${NEXUS_CELL} font-medium`}>Dollar nexus</th>
                <th className={`${NEXUS_CELL} font-medium`}>Sale nexus</th>
                <th className={`${NEXUS_CELL} font-medium`}>Registration cost</th>
                <th className={`${NEXUS_CELL} font-medium`}>Renewal</th>
                <th className={`${NEXUS_CELL} font-medium`}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const atOrOverDollarNexus = saleAmountMeetsDollarNexus(r, variant);
                const atOrOverTransactionNexus = orderCountMeetsTransactionNexus(r, variant);
                const nearNexus = isNearNexusThreshold(r, variant);
                const mutedNexusCell = nearNexus ? "" : "text-zinc-400";
                const registrationCost = registrationCostLabel(r, variant);
                const registrationCostClass =
                  registrationCost === "Free" || registrationCost === "—"
                    ? NEXUS_SUBDUED_TEXT
                    : "text-zinc-400";
                const registrationRenewal = registrationRenewalLabel(r, variant);
                const registeredDate = registrationDatesByCode[r.code] ?? "";
                const renewalNear =
                  variant === "us" &&
                  isSalesTaxRegistrationRenewalWithinDays(r.code, registeredDate || null, {
                    withinDays: NEXUS_RENEWAL_NEAR_DAYS,
                  });
                const registrationRenewalClass = renewalNear
                  ? "text-red-400"
                  : isSubduedRegistrationRenewalLabel(registrationRenewal)
                    ? NEXUS_SUBDUED_TEXT
                    : "text-zinc-400";
                const saleNexus = transactionNexusLabel(r, variant);
                const saleNexusClass = saleNexus === "—" ? NEXUS_SUBDUED_TEXT : mutedNexusCell;
                const saveState =
                  registeredDateSaveState?.code === r.code ? registeredDateSaveState : null;
                return (
                  <tr
                    key={r.code}
                    className={`border-b border-zinc-900 ${nearNexus ? "text-red-400" : "text-zinc-300"}`}
                  >
                    <td className={`${NEXUS_CELL} font-mono text-[11px]`}>{r.code}</td>
                    <td
                      className={`${NEXUS_CELL} tabular-nums ${
                        r.orderCount === 0
                          ? NEXUS_SUBDUED_TEXT
                          : atOrOverTransactionNexus
                            ? "text-amber-200/95"
                            : ""
                      }`}
                    >
                      {r.orderCount}
                    </td>
                    <td
                      className={`${NEXUS_CELL} tabular-nums ${
                        r.merchandiseCents === 0
                          ? NEXUS_SUBDUED_TEXT
                          : atOrOverDollarNexus
                            ? "text-amber-200/95"
                            : ""
                      }`}
                    >
                      {formatPrice(r.merchandiseCents)}
                    </td>
                    <td
                      className={`${NEXUS_CELL} tabular-nums text-[11px] ${NEXUS_AMOUNT_UNTIL_DIVIDER} ${
                        isNearDollarNexus(r, variant) || isNearTransactionNexus(r, variant)
                          ? "text-red-400"
                          : mutedNexusCell
                      }`}
                    >
                      {amountUntilNexusContent(r, variant)}
                    </td>
                    <td className={`${NEXUS_CELL} text-[11px] ${mutedNexusCell}`}>
                      {dollarNexusLabel(r, variant)}
                    </td>
                    <td className={`${NEXUS_CELL} tabular-nums text-[11px] ${saleNexusClass}`}>
                      {saleNexus}
                    </td>
                    <td className={`${NEXUS_CELL} text-[11px] ${registrationCostClass}`}>
                      {registrationCost}
                    </td>
                    <td className={`${NEXUS_CELL} text-[11px] ${registrationRenewalClass}`}>
                      {registrationRenewal}
                    </td>
                    <td className={NEXUS_CELL}>
                      {variant === "us" ? (
                        <div className="relative min-w-0">
                          <input
                            type="date"
                            value={registeredDate}
                            onChange={(e) => onRegisteredDateChange(r.code, e.target.value)}
                            aria-label={`Registered date for ${r.code}`}
                            className={`w-full min-w-0 rounded border border-zinc-800 bg-zinc-950/60 px-1 py-1 text-[11px] tabular-nums focus:border-zinc-600 focus:outline-none ${
                              registeredDate ? "text-zinc-300" : "text-zinc-800"
                            } [color-scheme:dark]`}
                          />
                          {registeredDate ? (
                            <button
                              type="button"
                              onClick={() => onRegisteredDateClear(r.code)}
                              className="mt-0.5 text-[9px] text-zinc-600 hover:text-zinc-400"
                            >
                              Clear
                            </button>
                          ) : null}
                          {saveState?.status === "pending" ? (
                            <span className="pointer-events-none absolute -bottom-3 left-0 text-[9px] text-zinc-600">
                              …
                            </span>
                          ) : saveState?.status === "saved" ? (
                            <span className="pointer-events-none absolute -bottom-3 left-0 text-[9px] text-emerald-500/80">
                              Saved
                            </span>
                          ) : saveState?.status === "error" ? (
                            <span
                              className="pointer-events-none absolute -bottom-3 left-0 text-[9px] text-red-400/90"
                              role="alert"
                            >
                              !
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className={NEXUS_SUBDUED_TEXT}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminNexusPlanningTab(props: {
  snapshot: AdminNexusPlanningSnapshot;
  computedAtIso: string | null;
  cacheNote: string | null;
  demoSalesActive?: boolean;
  registrationDatesByCode: AdminNexusRegistrationDatesByCode;
}) {
  const { snapshot, computedAtIso, cacheNote, demoSalesActive, registrationDatesByCode } = props;
  const { withSalesTax: usWithSalesTax, withoutSalesTax: usWithoutSalesTax } = partitionUsStates(
    snapshot.usStates,
  );

  const serverDatesRef = useRef(registrationDatesByCode);
  const [datesByCode, setDatesByCode] = useState(registrationDatesByCode);
  const [saveState, setSaveState] = useState<RegisteredDateSaveState | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    serverDatesRef.current = registrationDatesByCode;
    setDatesByCode(registrationDatesByCode);
  }, [registrationDatesByCode]);

  function persistRegisteredDate(code: string, isoDate: string) {
    const baseline = serverDatesRef.current[code] ?? "";
    if (isoDate === baseline) return;

    startTransition(async () => {
      setSaveState({ code, status: "pending" });
      const result = await adminSaveNexusRegistrationDate(
        code,
        isoDate.length > 0 ? isoDate : null,
      );
      if (result.ok) {
        const next = { ...serverDatesRef.current };
        if (isoDate.length === 0) {
          delete next[code];
        } else {
          next[code] = isoDate;
        }
        serverDatesRef.current = next;
        setSaveState({ code, status: "saved" });
        window.setTimeout(() => {
          setSaveState((current) => (current?.code === code && current.status === "saved" ? null : current));
        }, 1500);
      } else {
        setDatesByCode(serverDatesRef.current);
        setSaveState({ code, status: "error", error: result.error });
      }
    });
  }

  function onRegisteredDateChange(code: string, isoDate: string) {
    setDatesByCode((prev) => {
      const next = { ...prev };
      if (isoDate.length === 0) {
        delete next[code];
      } else {
        next[code] = isoDate;
      }
      return next;
    });
    persistRegisteredDate(code, isoDate);
  }

  function onRegisteredDateClear(code: string) {
    onRegisteredDateChange(code, "");
  }

  const computedAt = computedAtIso ? new Date(computedAtIso) : null;

  return (
    <section aria-label="Nexus planning">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Nexus planning</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Paid item orders grouped by ship-to destination from Stripe checkout. Sale amount is merchandise line totals.
        Dollar nexus is the reference sales threshold; sale nexus is the transaction count threshold (US states only).
        Registration cost is the approximate remote-seller permit fee; renewal is how often the permit
        must be renewed (verify with each state). Registered is the date you registered in that state
        (saved when you pick a date). Renewal turns red when that date plus the renewal period is within 60
        days. Rows turn red when within $400 of dollar nexus or within 10
        sales of sale nexus. Sale amount and order count turn amber when at or above the
        respective threshold. All-time totals refresh at most once per week when there was a paid order in the last 7
        days.
      </p>
      {demoSalesActive ? (
        <p className="mt-1 text-[11px] text-amber-200/80">
          Demo sales included: OK 1×$45, MO 5×$30, ME 3×$30 (development overlay).
        </p>
      ) : null}
      {computedAt ? (
        <p className="mt-1 text-[11px] text-zinc-600">
          Last rollup:{" "}
          <time dateTime={computedAt.toISOString()}>{computedAt.toLocaleString()}</time>
          {cacheNote ? `. ${cacheNote}` : null}
        </p>
      ) : null}

      <div className="mt-6 space-y-8">
        <div className="space-y-6">
          <DestinationTable
            title="United States — with state sales tax"
            codeLabel="State"
            rows={usWithSalesTax}
            emptyMessage=""
            variant="us"
            registrationDatesByCode={datesByCode}
            onRegisteredDateChange={onRegisteredDateChange}
            onRegisteredDateClear={onRegisteredDateClear}
            registeredDateSaveState={saveState}
          />
          <DestinationTable
            title="United States — no state sales tax"
            codeLabel="State"
            rows={usWithoutSalesTax}
            emptyMessage=""
            variant="us"
            registrationDatesByCode={datesByCode}
            onRegisteredDateChange={onRegisteredDateChange}
            onRegisteredDateClear={onRegisteredDateClear}
            registeredDateSaveState={saveState}
          />
        </div>
        <DestinationTable
          title="Outside the US — by country"
          codeLabel="Country"
          rows={snapshot.international}
          emptyMessage="No paid international orders in this range."
          variant="intl"
          registrationDatesByCode={datesByCode}
          onRegisteredDateChange={onRegisteredDateChange}
          onRegisteredDateClear={onRegisteredDateClear}
          registeredDateSaveState={saveState}
        />
        {snapshot.missingDestination ? (
          <DestinationTable
            title="Missing ship-to"
            codeLabel="Destination"
            rows={[snapshot.missingDestination]}
            emptyMessage=""
            variant="missing"
            registrationDatesByCode={datesByCode}
            onRegisteredDateChange={onRegisteredDateChange}
            onRegisteredDateClear={onRegisteredDateClear}
            registeredDateSaveState={saveState}
          />
        ) : null}
      </div>
    </section>
  );
}
