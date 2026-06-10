export type WorldCountryOption = {
  code: string;
  label: string;
};

const EXCLUDED_COUNTRY_CODES = new Set(["US"]);

/** ISO 3166-1 alpha-2 codes — stable fallback when Intl.supportedValuesOf("region") is unavailable. */
const ISO_ALPHA2_COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

function isoAlpha2RegionCodes(): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;

  if (typeof supportedValuesOf === "function") {
    try {
      const fromIntl = supportedValuesOf("region").filter((code) => /^[A-Z]{2}$/.test(code));
      if (fromIntl.length >= 200) {
        return fromIntl;
      }
    } catch {
      // Fall back to static ISO list below.
    }
  }

  return ISO_ALPHA2_COUNTRY_CODES.filter((code) => !EXCLUDED_COUNTRY_CODES.has(code));
}

function buildWorldCountriesExcludingUs(locale = "en"): WorldCountryOption[] {
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  return isoAlpha2RegionCodes()
    .filter((code) => !EXCLUDED_COUNTRY_CODES.has(code))
    .map((code) => ({
      code,
      label: regions.of(code) ?? code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }));
}

let cachedWorldCountriesExcludingUs: WorldCountryOption[] | null = null;

export function worldCountriesExcludingUs(locale = "en"): WorldCountryOption[] {
  if (locale === "en" && cachedWorldCountriesExcludingUs) {
    return cachedWorldCountriesExcludingUs;
  }
  const list = buildWorldCountriesExcludingUs(locale);
  if (locale === "en") {
    cachedWorldCountriesExcludingUs = list;
  }
  return list;
}

const worldCountryCodeSetExcludingUs = (): Set<string> =>
  new Set(worldCountriesExcludingUs().map((c) => c.code));

export function isWorldCountryCodeExcludingUs(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return false;
  return worldCountryCodeSetExcludingUs().has(normalized);
}

export function worldCountryLabelForCode(code: string, locale = "en"): string | null {
  const normalized = code.trim().toUpperCase();
  if (!isWorldCountryCodeExcludingUs(normalized)) return null;
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  return regions.of(normalized) ?? normalized;
}

/** Test-only reset for module cache. */
export function resetWorldCountriesCacheForTests(): void {
  cachedWorldCountriesExcludingUs = null;
}
