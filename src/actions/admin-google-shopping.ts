"use server";

import { redirect } from "next/navigation";
import {
  buildGoogleShoppingEnrollmentsCsv,
  loadAdminGoogleShoppingEnrollments,
} from "@/lib/admin-google-shopping-shops";
import { getAdminSessionReadonly } from "@/lib/session";

async function requireAdmin() {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");
}

export type AdminExportGoogleShoppingEnrollmentsCsvResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

export async function adminExportGoogleShoppingEnrollmentsCsv(): Promise<AdminExportGoogleShoppingEnrollmentsCsvResult> {
  await requireAdmin();
  try {
    const rows = await loadAdminGoogleShoppingEnrollments();
    const csv = buildGoogleShoppingEnrollmentsCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return { ok: true, csv, filename: `google-shopping-enrollments-${stamp}.csv` };
  } catch (e) {
    console.error("[adminExportGoogleShoppingEnrollmentsCsv]", e);
    return { ok: false, error: "Could not build export." };
  }
}
