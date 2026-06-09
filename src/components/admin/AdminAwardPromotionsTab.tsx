import Link from "next/link";
import type {
  AdminPromotionCreditBalanceRow,
  AdminRecentAwardGrantRow,
  AdminShopFreeListingGrantRow,
  AdminShopGoogleShoppingCreditRow,
  AdminShopSlugPick,
} from "@/actions/admin-award-promotions";
import { AdminAwardPromotionGrantForm } from "@/components/admin/AdminAwardPromotionGrantForm";
import { AdminRevokeAwardGrantButton } from "@/components/admin/AdminRevokeAwardGrantButton";
import { formatAdminAwardGrantSummary } from "@/lib/admin-award-promotions-catalog";
import { formatDisplayedDateTime } from "@/lib/format-display-datetime";

export function AdminAwardPromotionsTab(props: {
  grantRows: AdminShopFreeListingGrantRow[];
  promotionCreditRows: AdminPromotionCreditBalanceRow[];
  googleShoppingCreditRows: AdminShopGoogleShoppingCreditRow[];
  recentGrantRows: AdminRecentAwardGrantRow[];
  shopPickerOptions: AdminShopSlugPick[];
  apErr?: string;
  apSaved?: boolean;
  apRevoked?: boolean;
  apShop?: string;
  apAwardLabel?: string;
  apGranted?: number;
  apDetail?: string;
  migrationRequired?: boolean;
}) {
  const {
    grantRows,
    promotionCreditRows,
    googleShoppingCreditRows,
    recentGrantRows,
    shopPickerOptions,
    apErr,
    apSaved,
    apRevoked,
    apShop,
    apAwardLabel,
    apGranted,
    apDetail,
    migrationRequired,
  } = props;

  return (
    <section id="award-promotions" aria-label="Award promotions">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Award promotions</h2>
      {migrationRequired ? (
        <p className="mt-3 rounded border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          Award Promotions credit tables are not on this database yet. From the repo root with production env
          loaded, run:{" "}
          <code className="text-amber-100">npx prisma migrate deploy</code> (migration{" "}
          <code className="text-amber-100">20260528160000_shop_admin_award_promotions</code>). Free listing and
          Google Shopping grants still work; flair and promotion placement credits need the migration.
        </p>
      ) : null}
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        Grant free listing slots, shop flair access, Google Shopping credits, or promotion credits
        instantly. Credits land on the shop immediately — the owner uses them later on Shop upgrades
        (no Stripe). Revoke individual awards from Recent admin awards below.
      </p>

      {apRevoked && apShop ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90"
        >
          Revoked {formatAdminAwardGrantSummary(apGranted ?? 0, apAwardLabel)} from{" "}
          <span className="font-mono text-amber-100">{apShop}</span>.
        </p>
      ) : null}
      {apSaved && apShop ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Granted {formatAdminAwardGrantSummary(apGranted ?? 0, apAwardLabel)} to{" "}
          <span className="font-mono text-emerald-100">{apShop}</span>.
          {apDetail ? (
            <>
              {" "}
              <span className="text-emerald-200/80">({apDetail})</span>
            </>
          ) : null}
        </p>
      ) : null}
      {apErr ? (
        <p
          className="mt-3 rounded border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
          role="alert"
        >
          {apErr}
        </p>
      ) : null}

      <AdminAwardPromotionGrantForm shopPickerOptions={shopPickerOptions} />

      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Admin-awarded free listing slots
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Total slots granted on this tab. Excludes listing packs and gift codes the shop purchased or
          redeemed elsewhere.
        </p>
        {grantRows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No admin free listing grants recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 text-sm">
            {grantRows.map((r) => (
              <li key={r.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200">{r.displayName}</p>
                  <p className="font-mono text-xs text-zinc-500">
                    <Link href={`/s/${encodeURIComponent(r.slug)}`} className="text-blue-400/90 hover:underline">
                      /s/{r.slug}
                    </Link>
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-zinc-400">
                  {r.adminAwardedSlots} slot{r.adminAwardedSlots === 1 ? "" : "s"} awarded
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Admin-awarded promotion credits
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Total promotion credits granted on this tab (Hot, Popular, Featured, etc.).
        </p>
        {promotionCreditRows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No admin promotion credit grants recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 text-sm">
            {promotionCreditRows.map((r) => (
              <li
                key={`${r.slug}-${r.kind}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200">{r.displayName}</p>
                  <p className="font-mono text-xs text-zinc-500">/s/{r.slug}</p>
                </div>
                <p className="shrink-0 text-xs text-zinc-400">
                  {r.adminAwardedCredits} × {r.kindLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Admin-awarded Google Shopping credits
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Total Google Shopping credits granted on this tab. Excludes credits the shop bought on Shop
          upgrades.
        </p>
        {googleShoppingCreditRows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No admin Google Shopping grants recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 text-sm">
            {googleShoppingCreditRows.map((r) => (
              <li key={r.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200">{r.displayName}</p>
                  <p className="font-mono text-xs text-zinc-500">
                    <Link href={`/s/${encodeURIComponent(r.slug)}`} className="text-blue-400/90 hover:underline">
                      /s/{r.slug}
                    </Link>
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-zinc-400">
                  {r.adminAwardedCredits} credit{r.adminAwardedCredits === 1 ? "" : "s"} awarded
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recent admin awards</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Revoke removes credits from the shop and marks the grant revoked. Totals above exclude
          revoked grants.
        </p>
        {recentGrantRows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No grants recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 text-sm">
            {recentGrantRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={`text-zinc-200 ${r.revokedAtIso ? "line-through opacity-60" : ""}`}>
                    {r.quantity} × {r.awardLabel}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {r.shopDisplayName}{" "}
                    <span className="font-mono text-zinc-600">/s/{r.shopSlug}</span>
                  </p>
                  {r.revokedAtIso ? (
                    <p className="mt-1 text-[11px] text-amber-300/90">
                      Revoked {formatDisplayedDateTime(new Date(r.revokedAtIso))}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-[11px] tabular-nums text-zinc-600">
                    {formatDisplayedDateTime(new Date(r.grantedAtIso))}
                  </p>
                  <AdminRevokeAwardGrantButton grantId={r.id} disabled={Boolean(r.revokedAtIso)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
