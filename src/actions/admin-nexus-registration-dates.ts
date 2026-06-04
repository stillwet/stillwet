"use server";

import { redirect } from "next/navigation";
import {
  ADMIN_NEXUS_REGISTRATION_DATES_ID,
  isValidNexusRegistrationIsoDate,
  parseAdminNexusRegistrationDatesByCode,
} from "@/lib/admin-nexus-registration-dates";
import { prismaAdminNexusRegistrationDatesOrNull } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { getAdminSessionReadonly } from "@/lib/session";

export type AdminSaveNexusRegistrationDateResult = { ok: true } | { ok: false; error: string };

export async function adminSaveNexusRegistrationDate(
  jurisdictionCode: string,
  isoDateRaw: string | null,
): Promise<AdminSaveNexusRegistrationDateResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");

  const code = jurisdictionCode.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) {
    return { ok: false, error: "Invalid jurisdiction code." };
  }

  const isoDate = isoDateRaw?.trim() ?? "";
  if (isoDate.length > 0 && !isValidNexusRegistrationIsoDate(isoDate)) {
    return { ok: false, error: "Use a valid calendar date." };
  }

  const delegate = prismaAdminNexusRegistrationDatesOrNull();
  if (!delegate) {
    return {
      ok: false,
      error: "Registration dates are not available yet. Run prisma migrate deploy, then restart the dev server.",
    };
  }

  const existing = await delegate.findUnique({
    where: { id: ADMIN_NEXUS_REGISTRATION_DATES_ID },
    select: { datesByCode: true },
  });
  const datesByCode = parseAdminNexusRegistrationDatesByCode(existing?.datesByCode);

  if (isoDate.length === 0) {
    delete datesByCode[code];
  } else {
    datesByCode[code] = isoDate;
  }

  await delegate.upsert({
    where: { id: ADMIN_NEXUS_REGISTRATION_DATES_ID },
    create: {
      id: ADMIN_NEXUS_REGISTRATION_DATES_ID,
      datesByCode,
    },
    update: { datesByCode },
  });

  revalidateAdminViews();
  return { ok: true };
}
