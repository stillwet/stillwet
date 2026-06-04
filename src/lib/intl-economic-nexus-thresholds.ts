/**
 * Reference VAT / remote-seller registration thresholds for non-US ship-to countries.
 * Rules assume a US-based seller shipping B2C goods — approximate; verify locally.
 */
export type IntlEconomicNexusRule = {
  /**
   * Approximate USD equivalent for comparing to order merchandise (USD cents).
   * `0` = obligation from first B2C sale. `null` = no numeric threshold / N/A.
   */
  salesThresholdUsdCents: number | null;
  transactionThreshold: number | null;
  dollarLabel: string;
  transactionLabel: string;
};

/** EU member states (ISO 3166-1 alpha-2). */
export const EU_MEMBER_COUNTRY_CODES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const;

function intlDollarOnly(
  salesThresholdUsdCents: number | null,
  dollarLabel: string,
): IntlEconomicNexusRule {
  return {
    salesThresholdUsdCents,
    transactionThreshold: null,
    dollarLabel,
    transactionLabel: "—",
  };
}

const EU_US_REMOTE_SELLER: IntlEconomicNexusRule = intlDollarOnly(0, "First B2C sale");

const EU_RULES = Object.fromEntries(
  EU_MEMBER_COUNTRY_CODES.map((code) => [code, EU_US_REMOTE_SELLER]),
) as Record<(typeof EU_MEMBER_COUNTRY_CODES)[number], IntlEconomicNexusRule>;

/** ISO 3166-1 alpha-2 country codes → remote-seller nexus reference. */
export const INTL_ECONOMIC_NEXUS_BY_COUNTRY: Record<string, IntlEconomicNexusRule> = {
  ...EU_RULES,
  AU: intlDollarOnly(49_000_00, "AUD $75,000"),
  BR: intlDollarOnly(null, "Verify locally"),
  CA: intlDollarOnly(22_000_00, "CAD $30,000"),
  CH: intlDollarOnly(113_000_00, "CHF 100,000"),
  CL: intlDollarOnly(null, "First B2C sale"),
  CN: intlDollarOnly(null, "Verify locally"),
  CO: intlDollarOnly(null, "Verify locally"),
  GB: intlDollarOnly(0, "First B2C sale"),
  HK: intlDollarOnly(null, "No VAT"),
  ID: intlDollarOnly(null, "Verify locally"),
  IL: intlDollarOnly(null, "First B2C sale"),
  IN: intlDollarOnly(null, "Verify locally"),
  IS: intlDollarOnly(2_700_00, "ISK 2M"),
  JP: intlDollarOnly(67_000_00, "¥10M"),
  KR: intlDollarOnly(null, "Verify locally"),
  MX: intlDollarOnly(null, "Verify locally"),
  MY: intlDollarOnly(null, "Verify locally"),
  NO: intlDollarOnly(4_700_00, "NOK 50,000"),
  NZ: intlDollarOnly(36_000_00, "NZD $60,000"),
  PH: intlDollarOnly(null, "Verify locally"),
  SA: intlDollarOnly(null, "Verify locally"),
  SG: intlDollarOnly(null, "Verify locally"),
  TH: intlDollarOnly(null, "Verify locally"),
  TR: intlDollarOnly(null, "Verify locally"),
  TW: intlDollarOnly(null, "Verify locally"),
  AE: intlDollarOnly(null, "First B2C sale"),
  US: intlDollarOnly(null, "See US tables"),
  ZA: intlDollarOnly(null, "Verify locally"),
};

function ruleFor(countryCode: string): IntlEconomicNexusRule | undefined {
  return INTL_ECONOMIC_NEXUS_BY_COUNTRY[countryCode.trim().toUpperCase()];
}

export function intlEconomicNexusDollarLabel(countryCode: string): string {
  return ruleFor(countryCode)?.dollarLabel ?? "Verify locally";
}

export function intlEconomicNexusTransactionLabel(countryCode: string): string {
  return ruleFor(countryCode)?.transactionLabel ?? "—";
}

export function intlEconomicNexusSalesThresholdUsdCents(countryCode: string): number | null {
  return ruleFor(countryCode)?.salesThresholdUsdCents ?? null;
}

export function intlEconomicNexusTransactionThreshold(countryCode: string): number | null {
  return ruleFor(countryCode)?.transactionThreshold ?? null;
}
