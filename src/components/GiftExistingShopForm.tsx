"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { PromotionKind } from "@/generated/prisma/enums";
import {
  startCreatorGiftExistingShopCheckout,
  type StartCreatorGiftCheckoutResult,
} from "@/actions/gift-creator";
import {
  ensureGiftRecipientShopSelected,
  GiftCreatorShopPicker,
} from "@/components/GiftCreatorShopPicker";
import { FormValidationAlert } from "@/components/FormFieldValidationBubble";
import type { GiftRecipientShopPick } from "@/actions/gift-creator-shop-search";
import { promotionGrantFormFieldName } from "@/lib/creator-gift-promotion-grants";
import { existingShopGiftMerchandiseSubtotalCents } from "@/lib/creator-gift-existing-shop-merchandise";
import {
  GOOGLE_SHOPPING_CREDIT_PACKS,
  googleShoppingCreditPackById,
} from "@/lib/google-shopping-credit-packs";
import { LISTING_CREDIT_PACKS, listingCreditPackById } from "@/lib/listing-credit-packs";
import {
  PROMOTION_KIND_OPTIONS,
  promotionKindLabel,
  promotionPriceCentsForKind,
} from "@/lib/promotions";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const INITIAL_PROMOTION_QTY: Record<PromotionKind, string> = Object.fromEntries(
  PROMOTION_KIND_OPTIONS.map((o) => [o.kind, "0"]),
) as Record<PromotionKind, string>;

const GIFT_PROMOTION_ROW_LABEL: Partial<Record<PromotionKind, string>> = {
  [PromotionKind.HOT_FEATURED_ITEM]: "Hot Item Promo",
  [PromotionKind.MOST_POPULAR_OF_TAG_ITEM]: "Popular Item Promo",
  [PromotionKind.FEATURED_SHOP_HOME]: "Featured Shop Promo",
};

function giftPromotionPriceLabel(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents);
}

const GIFT_OPTION_ROW_CLASS =
  "flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-1.5";
const GIFT_PROMOTION_QTY_INPUT_CLASS =
  "w-14 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-center text-sm tabular-nums text-zinc-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] disabled:cursor-not-allowed disabled:opacity-50";
const GIFT_OPTION_ROW_SELECT_CLASS =
  "w-full min-w-0 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none [color-scheme:dark]";

function giftCreditPackOptionLabel(credits: number, priceCents: number): string {
  return `${credits} credits — ${giftPromotionPriceLabel(priceCents)}`;
}

export function GiftExistingShopForm(props: { onBack: () => void }) {
  const [includeListingCredits, setIncludeListingCredits] = useState(false);
  const [listingCreditPackId, setListingCreditPackId] = useState(
    LISTING_CREDIT_PACKS[0]?.id ?? "",
  );
  const [includePromotionCredits, setIncludePromotionCredits] = useState(false);
  const [includeGoogleShoppingCredits, setIncludeGoogleShoppingCredits] = useState(false);
  const [googleShoppingCreditPackId, setGoogleShoppingCreditPackId] = useState(
    GOOGLE_SHOPPING_CREDIT_PACKS[0]?.id ?? "",
  );
  const [includeShopFlair, setIncludeShopFlair] = useState(false);
  const [promotionQtyByKind, setPromotionQtyByKind] =
    useState<Record<PromotionKind, string>>(INITIAL_PROMOTION_QTY);
  const [selectedShop, setSelectedShop] = useState<GiftRecipientShopPick | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [state, action, pending] = useActionState<
    StartCreatorGiftCheckoutResult | undefined,
    FormData
  >(startCreatorGiftExistingShopCheckout, undefined);

  useEffect(() => {
    if (state?.ok) window.location.href = state.url;
  }, [state]);

  const promotionSummaryLines = useMemo(() => {
    if (!includePromotionCredits) return [];
    return PROMOTION_KIND_OPTIONS.flatMap((option) => {
      const qty = Number.parseInt(promotionQtyByKind[option.kind] ?? "0", 10);
      if (!Number.isFinite(qty) || qty <= 0) return [];
      const subtotalCents = promotionPriceCentsForKind(option.kind) * qty;
      return [`${qty} × ${promotionKindLabel(option.kind)} — ${formatUsd(subtotalCents)}`];
    });
  }, [includePromotionCredits, promotionQtyByKind]);

  const giftTotalMerchCents = useMemo(() => {
    const promotionGrants = includePromotionCredits
      ? PROMOTION_KIND_OPTIONS.flatMap((option) => {
          const credits = Number.parseInt(promotionQtyByKind[option.kind] ?? "0", 10);
          if (!Number.isFinite(credits) || credits <= 0) return [];
          return [{ kind: option.kind, credits }];
        })
      : [];

    const listingPack = includeListingCredits
      ? listingCreditPackById(listingCreditPackId)
      : null;
    const googlePack = includeGoogleShoppingCredits
      ? googleShoppingCreditPackById(googleShoppingCreditPackId)
      : null;

    return existingShopGiftMerchandiseSubtotalCents({
      listingPackPriceCents: listingPack?.priceCents ?? 0,
      googlePackPriceCents: googlePack?.priceCents ?? 0,
      promotionGrants,
      includeShopFlair,
    });
  }, [
    includeListingCredits,
    listingCreditPackId,
    includePromotionCredits,
    promotionQtyByKind,
    includeGoogleShoppingCredits,
    googleShoppingCreditPackId,
    includeShopFlair,
  ]);

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
    startTransition(() => {
      action(fd);
    });
  }

  const isPending = pending || state?.ok;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={props.onBack}
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back
      </button>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <p className="text-sm leading-relaxed text-zinc-400">
          Gift credits are sent directly to the shop for use, with a notification that you gifted
          them.
        </p>

        <GiftCreatorShopPicker
          fieldError={clientError}
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
            <ul className="mt-3 space-y-2">
              <li>
                <select
                  name="listingCreditPackId"
                  value={listingCreditPackId}
                  aria-label="Listing credit pack"
                  className={GIFT_OPTION_ROW_SELECT_CLASS}
                  onFocus={() => setIncludeListingCredits(true)}
                  onChange={(e) => {
                    setListingCreditPackId(e.target.value);
                    setIncludeListingCredits(true);
                  }}
                >
                  {LISTING_CREDIT_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {giftCreditPackOptionLabel(pack.credits, pack.priceCents)}
                    </option>
                  ))}
                </select>
              </li>
            </ul>
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
                <span className="block font-medium text-zinc-100">Upgrades</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  Promotions help boost shop/item visibility for two week periods.
                </span>
              </span>
            </label>
            <ul className="mt-3 space-y-2">
              {PROMOTION_KIND_OPTIONS.map((option) => (
                <li
                  key={option.kind}
                  className={GIFT_OPTION_ROW_CLASS}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                    {GIFT_PROMOTION_ROW_LABEL[option.kind] ?? option.label} —{" "}
                    <span className="tabular-nums text-zinc-500">
                      {giftPromotionPriceLabel(option.amountCents)}
                    </span>
                  </span>
                  <input
                    type="number"
                    name={promotionGrantFormFieldName(option.kind)}
                    min={0}
                    max={10}
                    value={promotionQtyByKind[option.kind]}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPromotionQtyByKind((prev) => ({
                        ...prev,
                        [option.kind]: value,
                      }));
                      const qty = Number.parseInt(value, 10);
                      if (Number.isFinite(qty) && qty >= 1) {
                        setIncludePromotionCredits(true);
                      }
                    }}
                    aria-label={`${GIFT_PROMOTION_ROW_LABEL[option.kind] ?? option.label} quantity`}
                    className={GIFT_PROMOTION_QTY_INPUT_CLASS}
                  />
                </li>
              ))}
            </ul>
            {promotionSummaryLines.length > 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {promotionSummaryLines.join(", ")}
              </p>
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
                  Help drive Google traffic to a shop with Google Shopping.
                </span>
              </span>
            </label>
            <ul className="mt-3 space-y-2">
              <li>
                <select
                  name="googleShoppingCreditPackId"
                  value={googleShoppingCreditPackId}
                  aria-label="Google Shopping credit pack"
                  className={GIFT_OPTION_ROW_SELECT_CLASS}
                  onFocus={() => setIncludeGoogleShoppingCredits(true)}
                  onChange={(e) => {
                    setGoogleShoppingCreditPackId(e.target.value);
                    setIncludeGoogleShoppingCredits(true);
                  }}
                >
                  {GOOGLE_SHOPPING_CREDIT_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {giftCreditPackOptionLabel(pack.credits, pack.priceCents)}
                    </option>
                  ))}
                </select>
              </li>
            </ul>
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
            <ul className="mt-3 space-y-2">
              <li
                className={`${GIFT_OPTION_ROW_CLASS} ${
                  !includeShopFlair ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  Shop Flair —{" "}
                  <span className="tabular-nums text-zinc-500">
                    {giftPromotionPriceLabel(SHOP_FLAIR_ACCESS_PRICE_CENTS)}
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </fieldset>

        {state && !state.ok ? <FormValidationAlert message={state.error} /> : null}

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
        >
          <span>{isPending ? "Starting checkout…" : "Continue to checkout"}</span>
          {!isPending ? (
            <span className="shrink-0 tabular-nums text-zinc-400">
              Gift Total {formatUsd(giftTotalMerchCents)}
            </span>
          ) : null}
        </button>
      </form>
    </div>
  );
}
