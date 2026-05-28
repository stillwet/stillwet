"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";

async function requireAdmin() {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) redirect("/admin/login");
}

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "flair";
}

async function uniqueTypeSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.shopFlairType.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function adminCreateFlairType(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      label: z.string().trim().min(1).max(60),
      slug: z.string().trim().optional(),
      sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
      active: z.boolean().default(true),
    })
    .safeParse({
      label: formData.get("label"),
      slug: formData.get("slug") ? String(formData.get("slug")) : undefined,
      sortOrder: formData.get("sortOrder"),
      active: formData.get("active") === "on",
    });
  if (!parsed.success) return;

  const base = slugify(parsed.data.slug?.trim() ? parsed.data.slug : parsed.data.label);
  const slug = await uniqueTypeSlug(base);

  await prisma.shopFlairType.create({
    data: {
      slug,
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
    },
  });
  revalidateAdminViews();
}

export async function adminUpdateFlairType(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const label = String(formData.get("label") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const active = formData.get("active") === "on";
  if (!label) return;

  await prisma.shopFlairType.update({
    where: { id },
    data: {
      label,
      sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      active,
    },
  });
  revalidateAdminViews();
}

export async function adminDeleteFlairType(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.shopFlairType.delete({ where: { id } });
  revalidateAdminViews();
}
