/**
 * Reference remote-seller sales tax registration fees and permit renewal cadence.
 * Approximate — verify with each state DOR; local/bond/deposit costs may apply.
 */
export type UsSalesTaxRegistrationCost = {
  label: string;
  renewalLabel: string;
};

export const US_SALES_TAX_REGISTRATION_COST_BY_STATE: Record<string, UsSalesTaxRegistrationCost> = {
  AL: { label: "Free", renewalLabel: "Annual" },
  AZ: { label: "$12 + $1–50/local", renewalLabel: "Annual" },
  AR: { label: "Free", renewalLabel: "No expiry" },
  CA: { label: "Free", renewalLabel: "No expiry" },
  CO: { label: "$16/site + $50 deposit", renewalLabel: "Every 2 yr" },
  CT: { label: "$100", renewalLabel: "Auto (2 yr)" },
  DC: { label: "Free", renewalLabel: "No expiry" },
  FL: { label: "Free", renewalLabel: "No expiry" },
  GA: { label: "Free", renewalLabel: "No expiry" },
  HI: { label: "$20", renewalLabel: "No expiry" },
  ID: { label: "Free", renewalLabel: "No expiry" },
  IL: { label: "Free", renewalLabel: "Annual" },
  IN: { label: "$25", renewalLabel: "Every 2 yr" },
  IA: { label: "Free", renewalLabel: "No expiry" },
  KS: { label: "Free", renewalLabel: "No expiry" },
  KY: { label: "Free", renewalLabel: "No expiry" },
  LA: { label: "Free", renewalLabel: "No expiry" },
  ME: { label: "Free", renewalLabel: "No expiry" },
  MD: { label: "Free", renewalLabel: "No expiry" },
  MA: { label: "Free", renewalLabel: "No expiry" },
  MI: { label: "Free", renewalLabel: "Annual" },
  MN: { label: "Free", renewalLabel: "No expiry" },
  MS: { label: "Free", renewalLabel: "No expiry" },
  MO: { label: "Free", renewalLabel: "No expiry" },
  NE: { label: "Free", renewalLabel: "No expiry" },
  NV: { label: "$15 + deposit", renewalLabel: "No expiry" },
  NJ: { label: "Free", renewalLabel: "No expiry" },
  NM: { label: "Free", renewalLabel: "No expiry" },
  NY: { label: "Free", renewalLabel: "No expiry" },
  NC: { label: "Free", renewalLabel: "No expiry" },
  ND: { label: "Free", renewalLabel: "No expiry" },
  OH: { label: "Free", renewalLabel: "No expiry" },
  OK: { label: "$20", renewalLabel: "Every 3 yr" },
  PA: { label: "Free", renewalLabel: "Every 5 yr" },
  RI: { label: "Free", renewalLabel: "Annual" },
  SC: { label: "$50", renewalLabel: "No expiry" },
  SD: { label: "Free", renewalLabel: "No expiry" },
  TN: { label: "Free", renewalLabel: "No expiry" },
  TX: { label: "Free", renewalLabel: "No expiry" },
  UT: { label: "Free", renewalLabel: "No expiry" },
  VT: { label: "Free", renewalLabel: "No expiry" },
  VA: { label: "Free", renewalLabel: "No expiry" },
  WA: { label: "$50 + $5/DBA", renewalLabel: "No expiry" },
  WV: { label: "$30", renewalLabel: "No expiry" },
  WI: { label: "$20", renewalLabel: "Every 2 yr" },
  WY: { label: "$60", renewalLabel: "No expiry" },
};

export function usSalesTaxRegistrationCostLabel(stateCode: string): string {
  const key = stateCode.trim().toUpperCase();
  return US_SALES_TAX_REGISTRATION_COST_BY_STATE[key]?.label ?? "—";
}

export function usSalesTaxRegistrationRenewalLabel(stateCode: string): string {
  const key = stateCode.trim().toUpperCase();
  return US_SALES_TAX_REGISTRATION_COST_BY_STATE[key]?.renewalLabel ?? "—";
}

export function usStateHasSalesTaxRegistrationReference(stateCode: string): boolean {
  return US_SALES_TAX_REGISTRATION_COST_BY_STATE[stateCode.trim().toUpperCase()] != null;
}

/** Subdued display for renewal cells (no periodic re-registration). */
export function isSubduedRegistrationRenewalLabel(label: string): boolean {
  return label === "No expiry" || label === "—";
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Renewal cadence in whole years; `null` when not periodic. */
export function renewalPeriodYearsFromLabel(renewalLabel: string): number | null {
  switch (renewalLabel) {
    case "Annual":
      return 1;
    case "Every 2 yr":
    case "Auto (2 yr)":
      return 2;
    case "Every 3 yr":
      return 3;
    case "Every 5 yr":
      return 5;
    default:
      return null;
  }
}

function parseIsoDateUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map((part) => Number(part));
  return new Date(Date.UTC(y, m - 1, d));
}

function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcYears(date: Date, years: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()),
  );
}

function diffDaysUtc(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** True when the next permit renewal is due within `withinDays` (includes up to that many days overdue). */
export function isSalesTaxRegistrationRenewalWithinDays(
  stateCode: string,
  registeredIsoDate: string | null | undefined,
  opts: { withinDays?: number; asOf?: Date } = {},
): boolean {
  const withinDays = opts.withinDays ?? 60;
  const asOf = utcStartOfDay(opts.asOf ?? new Date());
  const registered = registeredIsoDate?.trim();
  if (!registered) return false;

  const renewalLabel = usSalesTaxRegistrationRenewalLabel(stateCode);
  const periodYears = renewalPeriodYearsFromLabel(renewalLabel);
  if (periodYears == null) return false;

  let due = addUtcYears(parseIsoDateUtc(registered), periodYears);
  while (due.getTime() < asOf.getTime() - withinDays * MS_PER_DAY) {
    due = addUtcYears(due, periodYears);
  }

  const daysUntil = diffDaysUtc(asOf, due);
  return daysUntil <= withinDays && daysUntil >= -withinDays;
}
