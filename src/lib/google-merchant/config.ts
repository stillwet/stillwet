export type GoogleMerchantConfig = {
  enabled: boolean;
  accountId: string;
  dataSourceId: string;
  dataSourceName: string;
  feedLabel: string;
  contentLanguage: string;
  defaultProductCategory: string;
  serviceAccount: {
    clientEmail: string;
    privateKey: string;
  };
};

function parseServiceAccountJson(raw: string): { client_email: string; private_key: string } | null {
  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    const clientEmail = parsed.client_email?.trim();
    const privateKey = parsed.private_key?.trim();
    if (!clientEmail || !privateKey) return null;
    return { client_email: clientEmail, private_key: privateKey };
  } catch {
    return null;
  }
}

/** Returns config when sync is fully configured; null when disabled or incomplete. */
export function googleMerchantConfigFromEnv(): GoogleMerchantConfig | null {
  const enabled =
    process.env.GOOGLE_MERCHANT_SYNC_ENABLED === "1" ||
    process.env.GOOGLE_MERCHANT_SYNC_ENABLED === "true";
  if (!enabled) return null;

  const accountId = process.env.GOOGLE_MERCHANT_ACCOUNT_ID?.trim();
  const dataSourceId = process.env.GOOGLE_MERCHANT_DATASOURCE_ID?.trim();
  if (!accountId || !dataSourceId) return null;

  const saRaw = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON?.trim();
  const sa = saRaw ? parseServiceAccountJson(saRaw) : null;
  if (!sa) return null;

  const feedLabel = process.env.GOOGLE_MERCHANT_FEED_LABEL?.trim() || "US";
  const contentLanguage = process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE?.trim() || "en";
  const defaultProductCategory =
    process.env.GOOGLE_MERCHANT_DEFAULT_PRODUCT_CATEGORY?.trim() ||
    "Apparel & Accessories";

  return {
    enabled: true,
    accountId,
    dataSourceId,
    dataSourceName: `accounts/${accountId}/dataSources/${dataSourceId}`,
    feedLabel,
    contentLanguage,
    defaultProductCategory,
    serviceAccount: {
      clientEmail: sa.client_email,
      privateKey: sa.private_key.replace(/\\n/g, "\n"),
    },
  };
}

export function googleMerchantSyncEnabled(): boolean {
  return googleMerchantConfigFromEnv() != null;
}

export function googleMerchantProductId(
  config: GoogleMerchantConfig,
  offerId: string,
): string {
  return `${config.contentLanguage}~${config.feedLabel}~${offerId}`;
}
