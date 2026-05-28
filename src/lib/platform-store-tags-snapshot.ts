import { prisma } from "@/lib/prisma";
import {
  marketplaceAggregatedListingWhere,
} from "@/lib/shop-listing-storefront-visibility";

const SNAPSHOT_ID = "default";

export type PlatformStoreTagRow = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

function parseTagsJson(raw: unknown): PlatformStoreTagRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PlatformStoreTagRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.slug !== "string" || typeof o.name !== "string") {
      continue;
    }
    out.push({
      id: o.id,
      slug: o.slug,
      name: o.name,
      sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : 0,
    });
  }
  return out;
}

const liveListingProductWhere = { active: true } as const;

export async function rebuildPlatformStoreTagsSnapshot(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const delegate = (prisma as { platformStoreTagsSnapshot?: { upsert?: unknown } })
    .platformStoreTagsSnapshot;
  if (!delegate?.upsert) {
    return { ok: false, error: "PlatformStoreTagsSnapshot delegate missing (run prisma generate)" };
  }

  try {
    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          {
            productTags: {
              some: {
                product: {
                  ...liveListingProductWhere,
                  shopListings: { some: { ...marketplaceAggregatedListingWhere } },
                },
              },
            },
          },
          {
            primaryProducts: {
              some: {
                ...liveListingProductWhere,
                shopListings: { some: { ...marketplaceAggregatedListingWhere } },
              },
            },
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, sortOrder: true },
    });

    await prisma.platformStoreTagsSnapshot.upsert({
      where: { id: SNAPSHOT_ID },
      create: {
        id: SNAPSHOT_ID,
        tagsJson: tags,
        computedAt: new Date(),
      },
      update: {
        tagsJson: tags,
        computedAt: new Date(),
      },
    });

    return { ok: true, count: tags.length };
  } catch (e) {
    console.error("[rebuildPlatformStoreTagsSnapshot]", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function getPlatformStoreTagsFromSnapshot(): Promise<PlatformStoreTagRow[] | null> {
  const delegate = (prisma as { platformStoreTagsSnapshot?: { findUnique?: unknown } })
    .platformStoreTagsSnapshot;
  if (!delegate?.findUnique) return null;

  try {
    const row = await prisma.platformStoreTagsSnapshot.findUnique({
      where: { id: SNAPSHOT_ID },
      select: { tagsJson: true },
    });
    if (!row) return null;
    const parsed = parseTagsJson(row.tagsJson);
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}
