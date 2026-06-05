import { CreatorGiftCodeType, CreatorGiftPurchaseStatus } from "@/generated/prisma/enums";
import {
  creatorGiftCodeUsageStatus,
  purchasedShopSetupGiftCodeEffectiveExpiresAt,
  type CreatorGiftCodeUsageStatus,
} from "@/lib/creator-gift-code-expiration";
import { prisma } from "@/lib/prisma";

export type AdminWaivedShopFeeCodeRow = {
  codeId: string;
  code: string;
  createdAt: string;
  adminNotes: string | null;
  status: CreatorGiftCodeUsageStatus;
  shopName: string | null;
  shopSlug: string | null;
  usedAt: string | null;
};

export type AdminGiftedShopSetupCodeRow = {
  codeId: string;
  code: string;
  status: CreatorGiftCodeUsageStatus;
  expiresAt: string | null;
  purchaserEmail: string | null;
  paidAt: string | null;
  shopName: string | null;
  shopSlug: string | null;
  usedAt: string | null;
};

export type AdminWaivedShopFeesDashboardPayload = {
  adminProvidedCodes: AdminWaivedShopFeeCodeRow[];
  giftedCodes: AdminGiftedShopSetupCodeRow[];
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

type ShopSummary = { displayName: string; slug: string };

async function shopsById(ids: string[]): Promise<Map<string, ShopSummary>> {
  if (ids.length === 0) return new Map();
  return new Map(
    (
      await prisma.shop.findMany({
        where: { id: { in: ids } },
        select: { id: true, displayName: true, slug: true },
      })
    ).map((shop) => [shop.id, shop]),
  );
}

function mapRedeemedShop(
  row: {
    redeemedByShopId: string | null;
    redeemedByShop: ShopSummary | null;
  },
  shopsByIdMap: Map<string, ShopSummary>,
): ShopSummary | null {
  return (
    row.redeemedByShop ??
    (row.redeemedByShopId ? (shopsByIdMap.get(row.redeemedByShopId) ?? null) : null)
  );
}

export async function loadAdminWaivedShopFeesDashboardPayload(): Promise<AdminWaivedShopFeesDashboardPayload> {
  const [adminCodeRows, giftedCodeRows] = await Promise.all([
    prisma.creatorGiftCode.findMany({
      where: {
        type: CreatorGiftCodeType.shop_setup,
        purchase: { isWaivedShopFeeBatch: true },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        createdAt: true,
        adminNotes: true,
        redeemedAt: true,
        redeemedByShopId: true,
        redeemedByShop: {
          select: {
            displayName: true,
            slug: true,
          },
        },
      },
    }),
    prisma.creatorGiftCode.findMany({
      where: {
        type: CreatorGiftCodeType.shop_setup,
        purchase: {
          setupFeeIncluded: true,
          status: CreatorGiftPurchaseStatus.paid,
          isBetaTesterBatch: false,
          isWaivedShopFeeBatch: false,
        },
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
        purchase: {
          select: {
            purchaserEmail: true,
            paidAt: true,
          },
        },
      },
    }),
  ]);

  const missingShopIds = [...adminCodeRows, ...giftedCodeRows]
    .filter((row) => row.redeemedByShopId && !row.redeemedByShop)
    .map((row) => row.redeemedByShopId!)
    .filter((id, index, all) => all.indexOf(id) === index);

  const shopsByIdMap = await shopsById(missingShopIds);

  const adminProvidedCodes: AdminWaivedShopFeeCodeRow[] = adminCodeRows.map((row) => {
    const shop = mapRedeemedShop(row, shopsByIdMap);

    return {
      codeId: row.id,
      code: row.code,
      createdAt: row.createdAt.toISOString(),
      adminNotes: row.adminNotes,
      status: creatorGiftCodeUsageStatus({
        redeemedAt: row.redeemedAt,
        expiresAt: null,
      }),
      shopName: shop?.displayName ?? null,
      shopSlug: shop?.slug ?? null,
      usedAt: iso(row.redeemedAt),
    };
  });

  const giftedCodes: AdminGiftedShopSetupCodeRow[] = giftedCodeRows.map((row) => {
    const shop = mapRedeemedShop(row, shopsByIdMap);
    const expiresAt = purchasedShopSetupGiftCodeEffectiveExpiresAt({
      createdAt: row.createdAt,
    });

    return {
      codeId: row.id,
      code: row.code,
      status: creatorGiftCodeUsageStatus({
        redeemedAt: row.redeemedAt,
        expiresAt,
      }),
      expiresAt: iso(expiresAt),
      purchaserEmail: row.purchase.purchaserEmail,
      paidAt: iso(row.purchase.paidAt),
      shopName: shop?.displayName ?? null,
      shopSlug: shop?.slug ?? null,
      usedAt: iso(row.redeemedAt),
    };
  });

  return { adminProvidedCodes, giftedCodes };
}
