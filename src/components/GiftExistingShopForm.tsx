"use client";

import { useActionState, useEffect, useState } from "react";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  startCreatorGiftExistingShopCheckout,
  type StartCreatorGiftCheckoutResult,
} from "@/actions/gift-creator";
import {
  ensureGiftRecipientShopSelected,
  GiftCreatorShopPicker,
} from "@/components/GiftCreatorShopPicker";
import type { GiftRecipientShopPick } from "@/actions/gift-creator-shop-search";
import { GOOGLE_SHOPPING_CREDIT_PACKS } from "@/lib/google-shopping-credit-packs";
import { LISTING_CREDIT_PACKS } from "@/lib/listing-credit-packs";
import {
  PROMOTION_KIND_OPTIONS,
  promotionKindLabel,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function GiftExistingShopForm(props: { onBack: () => void }) {
  const [includeListingCredits, setIncludeListingCredits] = useState(false);
  const [includePromotionCredits, setIncludePromotionCredits] = useState(false);
  const [includeGoogleShoppingCredits, setIncludeGoogleShoppingCredits] = useState(false);
  const [includeShopFlair, setIncludeShopFlair] = useState(false);
  const [promotionKind, setPromotionKind] = useState<PromotionKind>(
    PROMOTION_KIND_OPTIONS[0]?.kind ?? PromotionKind.HOT_FEATURED_ITEM,
  );
  const [promotionCredits, setPromotionCredits] = useState("1");
  const [selectedShop, setSelectedShop] = useState<GiftRecipientShopPick | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [state, action, pending] = useActionState<
    StartCreatorGiftCheckoutResult | undefined,
    FormData
  >(startCreatorGiftExistingShopCheckout, undefined);

  useEffect(() => {
    if (state?.ok) window.location.href = state.url;
  }, [state]);

  const selectedPromotion = PROMOTION_KIND_OPTIONS.find((o) => o.kind === promotionKind);
  const promotionUnitCents = selectedPromotion
    ? promotionPriceCentsForKind(selectedPromotion.kind)
    : 0;
  const promotionQty = Number.parseInt(promotionCredits, 10);
  const promotionGiftLabel =
    includePromotionCredits && selectedPromotion && Number.isFinite(promotionQty) && promotionQty > 0
      ? `${promotionQty} × ${promotionKindLabel(selectedPromotion.kind)} — ${formatUsd(promotionUnitCents * promotionQty)}`
      : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);

    const form = e.currentTarget;
    const shopDisplay = (
      form.elements.namedItem("recipientShopSlugDisplay") as HTMLInputElement | null
    )?.value ?? "";

    const resolved = await ensureGiftRecipientShopSelected(shopDisplay, selectedShop);
    if (!resolved.ok) {
      setClientError(resolved.error);
      return;
    }

    const fd = new FormData(form);
    fd.set("recipientShopSlug", resolved.shop.slug);
    setSubmitting(true);
    try {
      await action(fd);
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = pending || submitting || state?.ok;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={props.onBack}
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back
      </button>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <p className="text-sm leading-relaxed text-zinc-400">
          Gift credits are sent directly to the shop for use, with a notification that you gifted
          them.
        </p>

        <GiftCreatorShopPicker
          onSelectedChange={(shop) => {
            setSelectedShop(shop);
            setClientError(null);
          }}
        />

        <label className="block text-sm text-zinc-400">
          Gift from: <span className="text-zinc-600">(optional)</span>
          <input
            type="text"
            name="giftFromName"
            maxLength={80}
            autoComplete="name"
            placeholder="Your name"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
          />
        </label>

        <fieldset className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <legend className="px-1 text-sm font-medium text-zinc-300">Gift options</legend>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="includeListingCredits"
                checked={includeListingCredits}
                onChange={(e) => setIncludeListingCredits(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-zinc-100">Listing Credits</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  3 listings free, additional listings are paid.
                </span>
              </span>
            </label>
            <select
              name="listingCreditPackId"
              disabled={!includeListingCredits}
              defaultValue={LISTING_CREDIT_PACKS[0]?.id ?? ""}
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {LISTING_CREDIT_PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="includePromotionCredits"
                checked={includePromotionCredits}
                onChange={(e) => setIncludePromotionCredits(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-zinc-100">Still Wet Visibility</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  Promotions help boost shop/item visibility for two week periods.
                </span>
              </span>
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                name="promotionKind"
                disabled={!includePromotionCredits}
                value={promotionKind}
                onChange={(e) => setPromotionKind(e.target.value as PromotionKind)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PROMOTION_KIND_OPTIONS.map((o) => (
                  <option key={o.kind} value={o.kind}>
                    {o.label} — {formatUsd(o.amountCents)} each
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="promotionCredits"
                min={1}
                max={10}
                disabled={!includePromotionCredits}
                value={promotionCredits}
                onChange={(e) => setPromotionCredits(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {promotionGiftLabel ? (
              <p className="mt-2 text-xs text-zinc-500">{promotionGiftLabel}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="includeGoogleShoppingCredits"
                checked={includeGoogleShoppingCredits}
                onChange={(e) => setIncludeGoogleShoppingCredits(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-zinc-100">Google Visibility</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  Help drive Google traffic to a shop.
                </span>
              </span>
            </label>
            <select
              name="googleShoppingCreditPackId"
              disabled={!includeGoogleShoppingCredits}
              defaultValue={GOOGLE_SHOPPING_CREDIT_PACKS[0]?.id ?? ""}
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {GOOGLE_SHOPPING_CREDIT_PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="includeShopFlair"
                checked={includeShopFlair}
                onChange={(e) => setIncludeShopFlair(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-zinc-100">Shop Flair</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  Unlock a badge for their shop on Still Wet.
                </span>
              </span>
            </label>
            <div
              className={`mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 ${
                !includeShopFlair ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              1 flair — {formatUsd(SHOP_FLAIR_ACCESS_PRICE_CENTS).replace(".00", "")}
            </div>
          </div>
        </fieldset>

        {clientError ? (
          <p className="text-sm text-amber-400" role="alert">
            {clientError}
          </p>
        ) : null}
        {state && !state.ok ? (
          <p className="text-sm text-amber-400" role="alert">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Starting checkout…" : "Continue to checkout"}
        </button>
      </form>
    </div>
  );
}
