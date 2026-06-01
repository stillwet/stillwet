import type { GoogleMerchantConfig } from "@/lib/google-merchant/config";
import { googleMerchantProductId } from "@/lib/google-merchant/config";
import { getGoogleMerchantAccessToken } from "@/lib/google-merchant/auth";
import type {
  GoogleMerchantInsertResponse,
  GoogleMerchantProductInput,
  GoogleMerchantProductResponse,
} from "@/lib/google-merchant/types";

const MERCHANT_API_BASE = "https://merchantapi.googleapis.com/products/v1";

async function merchantFetch<T>(
  config: GoogleMerchantConfig,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const token = await getGoogleMerchantAccessToken(config);
  const url = `${MERCHANT_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: T | { error?: { message?: string } } = {};
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const errObj = data as { error?: { message?: string } };
    const msg = errObj.error?.message ?? text.slice(0, 500) ?? `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: msg };
  }

  return { ok: true, data: data as T };
}

export async function insertGoogleMerchantProductInput(
  config: GoogleMerchantConfig,
  input: GoogleMerchantProductInput,
): Promise<
  | { ok: true; productName: string | null; productInputName: string | null }
  | { ok: false; error: string }
> {
  const parent = `accounts/${config.accountId}`;
  const qs = new URLSearchParams({ dataSource: config.dataSourceName });
  const result = await merchantFetch<GoogleMerchantInsertResponse>(
    config,
    `/${parent}/productInputs:insert?${qs.toString()}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    productName: result.data.product ?? null,
    productInputName: result.data.name ?? null,
  };
}

export async function deleteGoogleMerchantProductInput(
  config: GoogleMerchantConfig,
  offerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const productId = encodeURIComponent(googleMerchantProductId(config, offerId));
  const parent = `accounts/${config.accountId}`;
  const qs = new URLSearchParams({ dataSource: config.dataSourceName });
  const result = await merchantFetch<Record<string, never>>(
    config,
    `/${parent}/productInputs/${productId}?${qs.toString()}`,
    { method: "DELETE" },
  );

  if (!result.ok) {
    if (result.status === 404) return { ok: true };
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

export async function getGoogleMerchantProduct(
  config: GoogleMerchantConfig,
  offerId: string,
): Promise<
  | { ok: true; product: GoogleMerchantProductResponse; approvalStatus: string | null }
  | { ok: false; error: string }
> {
  const productId = encodeURIComponent(googleMerchantProductId(config, offerId));
  const parent = `accounts/${config.accountId}`;
  const result = await merchantFetch<GoogleMerchantProductResponse>(
    config,
    `/${parent}/products/${productId}`,
    { method: "GET" },
  );

  if (!result.ok) return { ok: false, error: result.error };

  const statuses = result.data.productStatus?.destinationStatuses ?? [];
  let approvalStatus: string | null = null;
  for (const s of statuses) {
    if (s.approvedCountries?.length) {
      approvalStatus = "approved";
      break;
    }
    if (s.disapprovedCountries?.length) {
      approvalStatus = "disapproved";
      break;
    }
  }
  if (!approvalStatus && statuses.length > 0) approvalStatus = "pending";

  return { ok: true, product: result.data, approvalStatus };
}
