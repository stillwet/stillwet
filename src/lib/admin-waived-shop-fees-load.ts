import { CreatorGiftCodeType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type AdminWaivedShopFeeCodeRow = {
  codeId: string;
  code: string;
  createdAt: string;
  status: "unused" | "used";
  shopName: string | null;
  shopSlug: string | null;
  usedAt: string | null;
};

export type AdminWaivedShopFeesDashboardPayload = {
  codes: AdminWaivedShopFeeCodeRow[];
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function loadAdminWaivedShopFeesDashboardPayload(): Promise<AdminWaivedShopFeesDashboardPayload> {
  const codeRows = await prisma.creatorGiftCode.findMany({
    where: {
      type: CreatorGiftCodeType.shop_setup,
      purchase: { isWaivedShopFeeBatch: true },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      createdAt: true,
      redeemedAt: true,
      redeemedByShopId: true,
      redeemedByShop: {
        select: {
          displayName: true,
          slug: true,
        },
      },
    },
  });

  const missingShopIds = codeRows
    .filter((row) => row.redeemedByShopId && !row.redeemedByShop)
    .map((row) => row.redeemedByShopId!)
    .filter((id, index, all) => all.indexOf(id) === index);

  const shopsById =
    missingShopIds.length === 0
      ? new Map<string, { displayName: string; slug: string }>()
      : new Map(
          (
            await prisma.shop.findMany({
              where: { id: { in: missingShopIds } },
              select: { id: true, displayName: true, slug: true },
            })
          ).map((shop) => [shop.id, shop]),
        );

  const codes: AdminWaivedShopFeeCodeRow[] = codeRows.map((row) => {
    const shop =
      row.redeemedByShop ??
      (row.redeemedByShopId ? (shopsById.get(row.redeemedByShopId) ?? null) : null);
    const used = row.redeemedAt != null;

    return {
      codeId: row.id,
      code: row.code,
      createdAt: row.createdAt.toISOString(),
      status: used ? "used" : "unused",
      shopName: shop?.displayName ?? null,
      shopSlug: shop?.slug ?? null,
      usedAt: iso(row.redeemedAt),
    };
  });

  return { codes };
}
