import { prisma } from "@/lib/prisma";
import { loadAdminCatalogItemsForListTab } from "@/lib/admin-baseline-catalog-rows";
import {
  loadAdminSecretMenuShopRows,
  loadAdminShopSlugPickerOptions,
} from "@/actions/admin-secret-menu";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import { AdminListAddItemForm } from "@/components/admin/AdminListAddItemForm";
import { AdminListItemsPanel } from "@/components/admin/AdminListItemsPanel";
import { AdminListTabLoadError } from "@/components/admin/AdminListTabLoadError";
import { AdminSecretMenuShopsPanel } from "@/components/admin/AdminSecretMenuShopsPanel";

type AdminSecretMenuTabProps = {
  smErr?: string;
  smGranted?: string;
  smRevoked?: string;
};

export async function AdminSecretMenuTab({ smErr, smGranted, smRevoked }: AdminSecretMenuTabProps) {
  try {
    const [items, allTags, shopRows, shopPickerOptions] = await Promise.all([
      loadAdminCatalogItemsForListTab({ secretMenuOnly: true }),
      prisma.tag.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      }),
      loadAdminSecretMenuShopRows(),
      loadAdminShopSlugPickerOptions(),
    ]);

    const serializable = items.map((item) => ({
      id: item.id,
      name: item.name,
      storefrontDescription: item.storefrontDescription,
      itemPlatformProductId: item.itemPlatformProductId,
      itemExampleListingUrl: item.itemExampleListingUrl,
      itemSizeExampleImageUrl: item.itemSizeExampleImageUrl,
      itemMinPriceCents: item.itemMinPriceCents,
      itemGoodsServicesCostCents: item.itemGoodsServicesCostCents,
      itemImageRequirementLabel: item.itemImageRequirementLabel,
      itemPrintAreaWidthPx: item.itemPrintAreaWidthPx,
      itemPrintAreaHeightPx: item.itemPrintAreaHeightPx,
      itemMinArtworkDpi: item.itemMinArtworkDpi,
      itemArtworkLetterboxFill: item.itemArtworkLetterboxFill,
      itemArtworkSourceTierOverride: item.itemArtworkSourceTierOverride,
      itemCanvasPresentation: item.itemCanvasPresentation,
      itemArtworkTemplate: item.itemArtworkTemplate,
      tags: item.catalogTags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        slug: ct.tag.slug,
      })),
    }));

    const r2Configured = isR2UploadConfigured();

    return (
      <section id="admin-secret-menu" aria-label="Secret menu">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Secret menu</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-600">
          Extended catalog items and prices for selected shops only. Items here never appear in the
          public Admin list or in other shops&apos; listing pickers.
        </p>

        <div className="mt-6">
          <AdminSecretMenuShopsPanel
            shopRows={shopRows}
            shopPickerOptions={shopPickerOptions}
            smErr={smErr}
            smGranted={smGranted}
            smRevoked={smRevoked}
          />
        </div>

        <div className="mt-8">
          <AdminListAddItemForm secretMenuCatalog />
        </div>

        <div className="mt-8">
          <AdminListItemsPanel
            items={serializable}
            allTags={allTags}
            r2Configured={r2Configured}
            secretMenuCatalog
          />
        </div>
      </section>
    );
  } catch (e) {
    console.error("[AdminSecretMenuTab]", e);
    const message = e instanceof Error ? e.message : String(e);
    return (
      <section id="admin-secret-menu" aria-label="Secret menu">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Secret menu</h2>
        <div className="mt-6">
          <AdminListTabLoadError message={message || "Unknown error"} />
        </div>
      </section>
    );
  }
}
