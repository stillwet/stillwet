import type { AdminNexusDestinationRow } from "@/lib/admin-nexus-planning-load";
import {
  intlEconomicNexusSalesThresholdUsdCents,
  intlEconomicNexusTransactionThreshold,
} from "@/lib/intl-economic-nexus-thresholds";
import {
  usEconomicNexusSalesThresholdCents,
  usEconomicNexusTransactionThreshold,
} from "@/lib/us-economic-nexus-thresholds";

const SORT_LAST = Number.MAX_SAFE_INTEGER;

/** Tie-break for equal sale amounts: lowest dollar nexus, then lowest sale nexus. */
function compareByNexusThresholds(
  a: AdminNexusDestinationRow,
  b: AdminNexusDestinationRow,
  dollarThresholdCents: (code: string) => number | null,
  transactionThreshold: (code: string) => number | null,
): number {
  const dollarA = dollarThresholdCents(a.code) ?? SORT_LAST;
  const dollarB = dollarThresholdCents(b.code) ?? SORT_LAST;
  if (dollarA !== dollarB) return dollarA - dollarB;

  const txA = transactionThreshold(a.code) ?? 0;
  const txB = transactionThreshold(b.code) ?? 0;
  if (txA !== txB) return txA - txB;

  return a.code.localeCompare(b.code);
}

function compareNexusDestinationRows(
  a: AdminNexusDestinationRow,
  b: AdminNexusDestinationRow,
  dollarThresholdCents: (code: string) => number | null,
  transactionThreshold: (code: string) => number | null,
): number {
  if (a.merchandiseCents !== b.merchandiseCents) {
    return b.merchandiseCents - a.merchandiseCents;
  }

  return compareByNexusThresholds(a, b, dollarThresholdCents, transactionThreshold);
}

export function sortUsNexusDestinationRows(rows: AdminNexusDestinationRow[]): AdminNexusDestinationRow[] {
  return [...rows].sort((a, b) =>
    compareNexusDestinationRows(
      a,
      b,
      usEconomicNexusSalesThresholdCents,
      usEconomicNexusTransactionThreshold,
    ),
  );
}

export function sortIntlNexusDestinationRows(rows: AdminNexusDestinationRow[]): AdminNexusDestinationRow[] {
  return [...rows].sort((a, b) =>
    compareNexusDestinationRows(
      a,
      b,
      intlEconomicNexusSalesThresholdUsdCents,
      intlEconomicNexusTransactionThreshold,
    ),
  );
}
