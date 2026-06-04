/**
 * Reference economic nexus thresholds for remote sellers (post-Wayfair).
 * Approximate — verify with each state DOR before registering.
 */
export type UsEconomicNexusRule = {
  /** Annual retail sales threshold when known; null if no dollar threshold or N/A. */
  salesThresholdCents: number | null;
  /** Annual transaction count threshold when known. */
  transactionThreshold: number | null;
  dollarLabel: string;
  transactionLabel: string;
};

const K100 = 100_000_00;
const K250 = 250_000_00;
const K500 = 500_000_00;

function dollarOnly(cents: number, dollarLabel: string): UsEconomicNexusRule {
  return {
    salesThresholdCents: cents,
    transactionThreshold: null,
    dollarLabel,
    transactionLabel: "—",
  };
}

function dollarAndSales(
  cents: number,
  dollarLabel: string,
  transactionThreshold: number,
): UsEconomicNexusRule {
  return {
    salesThresholdCents: cents,
    transactionThreshold,
    dollarLabel,
    transactionLabel: String(transactionThreshold),
  };
}

const NO_STATE_TAX: UsEconomicNexusRule = {
  salesThresholdCents: null,
  transactionThreshold: null,
  dollarLabel: "No state tax",
  transactionLabel: "—",
};

/** ISO 3166-2 style state codes → economic nexus reference. */
export const US_ECONOMIC_NEXUS_BY_STATE: Record<string, UsEconomicNexusRule> = {
  AL: dollarOnly(K250, "$250,000"),
  AK: NO_STATE_TAX,
  AZ: dollarOnly(K100, "$100,000"),
  AR: dollarAndSales(K100, "$100,000", 200),
  CA: dollarOnly(K500, "$500,000"),
  CO: dollarOnly(K100, "$100,000"),
  CT: dollarAndSales(K100, "$100,000", 200),
  DE: NO_STATE_TAX,
  DC: dollarAndSales(K100, "$100,000", 200),
  FL: dollarOnly(K100, "$100,000"),
  GA: dollarAndSales(K100, "$100,000", 200),
  HI: dollarAndSales(K100, "$100,000", 200),
  ID: dollarOnly(K100, "$100,000"),
  IL: dollarAndSales(K100, "$100,000", 200),
  IN: dollarAndSales(K100, "$100,000", 200),
  IA: dollarOnly(K100, "$100,000"),
  KS: dollarOnly(K100, "$100,000"),
  KY: dollarAndSales(K100, "$100,000", 200),
  LA: dollarAndSales(K100, "$100,000", 200),
  ME: dollarAndSales(K100, "$100,000", 200),
  MD: dollarAndSales(K100, "$100,000", 200),
  MA: dollarOnly(K100, "$100,000"),
  MI: dollarAndSales(K100, "$100,000", 200),
  MN: dollarAndSales(K100, "$100,000", 200),
  MS: dollarOnly(K250, "$250,000"),
  MO: dollarOnly(K100, "$100,000"),
  MT: NO_STATE_TAX,
  NE: dollarAndSales(K100, "$100,000", 200),
  NV: dollarAndSales(K100, "$100,000", 200),
  NH: NO_STATE_TAX,
  NJ: dollarAndSales(K100, "$100,000", 200),
  NM: dollarOnly(K100, "$100,000"),
  NY: dollarAndSales(K500, "$500,000", 100),
  NC: dollarAndSales(K100, "$100,000", 200),
  ND: dollarOnly(K100, "$100,000"),
  OH: dollarAndSales(K100, "$100,000", 200),
  OK: dollarOnly(K100, "$100,000"),
  OR: NO_STATE_TAX,
  PA: dollarOnly(K100, "$100,000"),
  RI: dollarAndSales(K100, "$100,000", 200),
  SC: dollarOnly(K100, "$100,000"),
  SD: dollarAndSales(K100, "$100,000", 200),
  TN: dollarOnly(K100, "$100,000"),
  TX: dollarOnly(K500, "$500,000"),
  UT: dollarAndSales(K100, "$100,000", 200),
  VT: dollarAndSales(K100, "$100,000", 200),
  VA: dollarAndSales(K100, "$100,000", 200),
  WA: dollarOnly(K100, "$100,000"),
  WV: dollarAndSales(K100, "$100,000", 200),
  WI: dollarOnly(K100, "$100,000"),
  WY: dollarAndSales(K100, "$100,000", 200),
};

/** All US states + DC in alphabetical order (51 jurisdictions). */
export const ALL_US_NEXUS_STATE_CODES = Object.keys(US_ECONOMIC_NEXUS_BY_STATE).sort();

/** States with no statewide sales tax (local taxes may still apply). */
export const US_STATES_WITHOUT_SALES_TAX = ALL_US_NEXUS_STATE_CODES.filter(
  (code) => US_ECONOMIC_NEXUS_BY_STATE[code]?.salesThresholdCents == null,
);

function ruleFor(stateCode: string): UsEconomicNexusRule | undefined {
  return US_ECONOMIC_NEXUS_BY_STATE[stateCode.trim().toUpperCase()];
}

export function usStateHasSalesTax(stateCode: string): boolean {
  const rule = ruleFor(stateCode);
  return rule != null && rule.salesThresholdCents != null;
}

export function usEconomicNexusDollarLabel(stateCode: string): string {
  return ruleFor(stateCode)?.dollarLabel ?? "—";
}

export function usEconomicNexusTransactionLabel(stateCode: string): string {
  return ruleFor(stateCode)?.transactionLabel ?? "—";
}

export function usEconomicNexusSalesThresholdCents(stateCode: string): number | null {
  return ruleFor(stateCode)?.salesThresholdCents ?? null;
}

export function usEconomicNexusTransactionThreshold(stateCode: string): number | null {
  return ruleFor(stateCode)?.transactionThreshold ?? null;
}
