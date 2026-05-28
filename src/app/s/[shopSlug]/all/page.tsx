import { ShopAllProductsPage } from "@/components/ShopAllProductsPage";
import { parseShopAllPageParam } from "@/lib/shop-all-browse-query";

type Props = {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopTenantAllPage({ params, searchParams }: Props) {
  const { shopSlug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const browseFlat = sp.flat === "1";
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : undefined;
  const page = parseShopAllPageParam(sp.page);
  return (
    <ShopAllProductsPage
      shopSlug={shopSlug}
      searchQuery={q}
      browseFlat={browseFlat}
      tagSlug={tag}
      browseSort={sort}
      page={page}
    />
  );
}
