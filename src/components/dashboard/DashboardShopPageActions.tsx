import Link from "next/link";

type DashboardShopPageActionsProps = {
  shopSlug: string;
  /** Link back to the main shop dashboard. */
  showDashboardLink?: boolean;
};

export function DashboardShopPageActions({
  shopSlug,
  showDashboardLink = false,
}: DashboardShopPageActionsProps) {
  const linkClass =
    "rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <a href={`/s/${shopSlug}`} className={linkClass}>
        View storefront
      </a>
      {showDashboardLink ? (
        <Link href="/dashboard" prefetch className={linkClass}>
          Dashboard
        </Link>
      ) : null}
    </div>
  );
}
