import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { slugify } from "@/lib/slugify";

/**
 * Allocates a unique `Shop.slug` from user-facing input (username / handle).
 * Excludes an existing shop id when renaming so the current slug does not count as “taken”.
 */
export async function allocateUniqueShopSlug(
  raw: string,
  excludeShopId?: string,
): Promise<{ slug: string } | { error: string }> {
  const base = slugify(raw.trim());
  if (!base || base === PLATFORM_SHOP_SLUG) {
    return {
      error: "That username resolves to a reserved or invalid URL. Try a different one.",
    };
  }
  for (let n = 0; n < 40; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await prisma.shop.findUnique({
      where: { slug: candidate },
      select: {
        id: true,
        _count: { select: { users: true } },
      },
    });
    if (!taken || taken.id === excludeShopId || taken._count.users === 0) {
      return { slug: candidate };
    }
  }
  return {
    error: "Could not allocate a unique shop URL from that username. Try a shorter or different one.",
  };
}

/** Slug for new signups: from display name when provided, otherwise a random internal handle. */
export async function allocateSignupShopSlug(
  displayName: string,
): Promise<{ slug: string } | { error: string }> {
  const trimmed = displayName.trim();
  if (trimmed) {
    const fromName = await allocateUniqueShopSlug(trimmed);
    if (!("error" in fromName)) return fromName;
  }
  return allocateUniqueShopSlug(`shop-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`);
}
