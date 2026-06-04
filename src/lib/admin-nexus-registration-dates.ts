import { prismaAdminNexusRegistrationDatesOrNull } from "@/lib/prisma";

export const ADMIN_NEXUS_REGISTRATION_DATES_ID = "default" as const;

/** ISO calendar date `YYYY-MM-DD` keyed by US state / country code. */
export type AdminNexusRegistrationDatesByCode = Record<string, string>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidNexusRegistrationIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function parseAdminNexusRegistrationDatesByCode(raw: unknown): AdminNexusRegistrationDatesByCode {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AdminNexusRegistrationDatesByCode = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = code.trim().toUpperCase();
    if (!key) continue;
    if (typeof value !== "string") continue;
    const date = value.trim();
    if (!isValidNexusRegistrationIsoDate(date)) continue;
    out[key] = date;
  }
  return out;
}

export function formatNexusRegistrationDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export async function loadAdminNexusRegistrationDatesByCode(): Promise<AdminNexusRegistrationDatesByCode> {
  const delegate = prismaAdminNexusRegistrationDatesOrNull();
  if (!delegate) return {};

  try {
    const row = await delegate.findUnique({
      where: { id: ADMIN_NEXUS_REGISTRATION_DATES_ID },
      select: { datesByCode: true },
    });
    return parseAdminNexusRegistrationDatesByCode(row?.datesByCode);
  } catch (e) {
    console.error("[admin] loadAdminNexusRegistrationDatesByCode failed", e);
    return {};
  }
}
