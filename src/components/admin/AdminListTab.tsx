import { prisma } from "@/lib/prisma";
import { loadAdminCatalogItemsForListTab } from "@/lib/admin-baseline-catalog-rows";
import { AdminListAddItemForm } from "@/components/admin/AdminListAddItemForm";
import { AdminListItemsPanel } from "@/components/admin/AdminListItemsPanel";
import { AdminListTabLoadError } from "@/components/admin/AdminListTabLoadError";

export async function AdminListTab() {
  try {
    const [items, allTags] = await Promise.all([
      loadAdminCatalogItemsForListTab(),
      prisma.tag.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const serializable = items.map((item) => ({
      id: item.id,
      name: item.name,
      storefrontDescription: item.storefrontDescription,
      itemPlatformProductId: item.itemPlatformProductId,
      itemExampleListingUrl: item.itemExampleListingUrl,
      itemMinPriceCents: item.itemMinPriceCents,
      itemGoodsServicesCostCents: item.itemGoodsServicesCostCents,
      itemImageRequirementLabel: item.itemImageRequirementLabel,
      itemPrintAreaWidthPx: item.itemPrintAreaWidthPx,
      itemPrintAreaHeightPx: item.itemPrintAreaHeightPx,
      itemMinArtworkDpi: item.itemMinArtworkDpi,
      itemArtworkLetterboxFill: item.itemArtworkLetterboxFill,
      tags: item.catalogTags.map((ct) => ({
        id: ct.tag.id,
        name: ct.tag.name,
        slug: ct.tag.slug,
      })),
    }));

    return (
      <section id="admin-baseline-list" aria-label="Admin list">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Admin list</h2>

        <div className="mt-6">
          <AdminListAddItemForm />
        </div>

        <div className="mt-8">
          <AdminListItemsPanel items={serializable} allTags={allTags} />
        </div>
      </section>
    );
  } catch (e) {
    console.error("[AdminListTab]", e);
    const message = e instanceof Error ? e.message : String(e);
    return (
      <section id="admin-baseline-list" aria-label="Admin list">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Admin list</h2>
        <div className="mt-6">
          <AdminListTabLoadError message={message || "Unknown error"} />
        </div>
      </section>
    );
  }
}
