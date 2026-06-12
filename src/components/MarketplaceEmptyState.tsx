import type { ReactNode } from "react";
import Link from "next/link";

export type MarketplaceEmptyVariant =
  | "marketplace-listings"
  | "marketplace-shops"
  | "shop-listings"
  | "search-results"
  | "shops-filter";

type Props = {
  variant: MarketplaceEmptyVariant;
  /** Optional counts shown when the marketplace DB is reachable but empty. */
  stats?: { creatorShops?: number; liveListings?: number };
  searchQuery?: string;
  children?: ReactNode;
};

function titleForVariant(variant: MarketplaceEmptyVariant, searchQuery?: string): string {
  switch (variant) {
    case "marketplace-listings":
      return "No items listed yet";
    case "marketplace-shops":
      return "No creator shops yet";
    case "shop-listings":
      return "No items in this shop yet";
    case "search-results":
      return searchQuery?.trim()
        ? `No results for “${searchQuery.trim()}”`
        : "No results for this search";
    case "shops-filter":
      return "No shops match this filter";
  }
}

function bodyForVariant(variant: MarketplaceEmptyVariant): string {
  switch (variant) {
    case "marketplace-listings":
      return "The store loaded data from Postgres successfully. There are no live marketplace listings to show — usually because no creator shops have published items yet.";
    case "marketplace-shops":
      return "The store loaded data from Postgres successfully. No creator shops are listed on the browse page yet.";
    case "shop-listings":
      return "The store loaded data from Postgres successfully. This shop has no active storefront listings yet.";
    case "search-results":
      return "The store loaded data from Postgres successfully. Nothing matched your search or filters.";
    case "shops-filter":
      return "The store loaded data from Postgres successfully. Try clearing the flair filter or browse all shops.";
  }
}

/** Empty catalog UI — distinct from {@link ShopDataLoadError} (Postgres/query failure). */
export function MarketplaceEmptyState({ variant, stats, searchQuery, children }: Props) {
  const showStats =
    stats &&
    (stats.creatorShops !== undefined || stats.liveListings !== undefined);

  if (variant === "shop-listings") {
    return (
      <div role="status" className="mt-8 text-center">
        <h2 className="text-base font-medium text-zinc-100">{titleForVariant(variant, searchQuery)}</h2>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 px-5 py-6 text-left sm:px-6"
    >
      <p className="inline-flex items-center gap-2 rounded-full border border-emerald-900/50 bg-emerald-950/30 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200/90">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/90" aria-hidden />
        Store loaded — not a database error
      </p>
      <h2 className="mt-4 text-base font-medium text-zinc-100">{titleForVariant(variant, searchQuery)}</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-zinc-400">{bodyForVariant(variant)}</p>
      {showStats ? (
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
          {stats.creatorShops !== undefined ? (
            <div>
              <dt className="inline text-zinc-600">Creator shops: </dt>
              <dd className="inline font-mono text-zinc-300">{stats.creatorShops}</dd>
            </div>
          ) : null}
          {stats.liveListings !== undefined ? (
            <div>
              <dt className="inline text-zinc-600">Live listings: </dt>
              <dd className="inline font-mono text-zinc-300">{stats.liveListings}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {children ? <div className="mt-4 text-sm text-zinc-500">{children}</div> : null}
      {variant === "marketplace-shops" ? (
        <p className="mt-4 text-sm">
          <Link href="/create-shop" className="text-blue-400 hover:underline">
            Create the first shop
          </Link>
        </p>
      ) : null}
    </div>
  );
}
