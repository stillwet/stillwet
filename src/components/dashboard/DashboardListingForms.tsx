"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Prisma } from "@/generated/prisma/client";
import { FulfillmentType } from "@/generated/prisma/enums";
import {
  dashboardClearListingSupplementPhoto,
  dashboardSetListingStorefrontCatalogImagesForm,
  dashboardSubmitListingRequest,
  dashboardUpdateListingItemName,
  dashboardUpdateListingStorefrontBlurb,
  dashboardUpdateListingSearchKeywords,
  dashboardUpdateListingPrice,
  dashboardWithdrawListingSupplementPending,
  dashboardUploadListingSupplementPhoto,
  type DashboardSubmitListingRequestResult,
  type ListingCatalogImagesFormState,
} from "@/actions/dashboard-marketplace";
import { printifyVariantShopFloorCents } from "@/lib/listing-cart-price";
import {
  SHOP_LISTING_MAX_PRICE_CENTS,
  shopListingMaxPriceUsdLabel,
} from "@/lib/marketplace-constants";
import { shopInReviewListingRequestLimitError } from "@/lib/listing-request-review-limit";
import { formatDisplayedDateTime } from "@/lib/format-display-datetime";
import { parseKeywordTokensFromStored } from "@/lib/search-keywords-normalize";
import { ListingSearchKeywordsChipInput } from "@/components/dashboard/ListingSearchKeywordsChipInput";
import {
  LISTING_EMBEDDED_PREVIEW_FRAME,
  LISTING_EMBEDDED_PREVIEW_FRAME_SELECTABLE,
  LISTING_EMBEDDED_PREVIEW_IMG,
  LISTING_EMBEDDED_PREVIEW_PLACEHOLDER,
  LISTING_EMBEDDED_THUMB_CONTROL,
  LISTING_FIELD_SAVE_ACTION,
  LISTING_FIELD_SAVE_PRIMARY,
  LISTING_FIELD_SAVE_ROW,
  LISTING_FIELD_SAVE_ROW_CENTER,
  LISTING_SUPPLEMENT_PREVIEW_PLACEHOLDER,
} from "@/components/dashboard/dashboard-listing-field-grid";
import {
  expectedShopProfitMerchandiseUnitCents,
  splitMerchandiseLineForCheckoutCents,
} from "@/lib/marketplace-fee";
import { catalogImageUrlKey } from "@/lib/product-media";
import {
  effectiveListingItemDisplayName,
  listingModerationMatchesByFieldForUi,
  listingRequestItemNameForHaystack,
  moderationTriggerErrorMessage,
} from "@/lib/moderation-keyword-scan";

const REQUEST_ITEM_NAME_MAX = 120;
const STOREFRONT_ITEM_BLURB_MAX = 280;

const disabledSave =
  "cursor-not-allowed rounded bg-zinc-900/50 px-3 py-1 text-xs font-medium text-zinc-500 ring-1 ring-zinc-800";
const activeSave =
  "rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700";
const savingSave =
  "cursor-wait rounded bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300";
const savedSave =
  "cursor-default rounded border border-emerald-900/40 bg-zinc-900/50 px-3 py-1 text-xs font-medium text-emerald-300/90";

const LISTING_AUTOSAVE_DEBOUNCE_MS = 750;

function ListingFieldAutoSaveStatus({
  pending,
  savedFlash,
  dirty,
}: {
  pending: boolean;
  savedFlash: boolean;
  dirty: boolean;
}) {
  const label = pending ? "Saving…" : savedFlash && !dirty ? "Saved" : "\u00a0";
  return (
    <span
      className={`inline-block min-w-[4rem] text-right text-xs font-medium tabular-nums ${
        pending ? "text-zinc-400" : savedFlash && !dirty ? "text-emerald-400/90" : "text-transparent"
      }`}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

type ItemNameFormProps = {
  listingId: string;
  catalogProductName: string;
  requestItemName: string | null;
  /** Rejected, creator-removed, or awaiting admin review (submitted / images ok / printify step). */
  readOnly?: boolean;
  moderationPhrases?: readonly string[];
  moderationStorefrontBlurb?: string | null;
  moderationListingSearchKeywords?: string | null;
};

export function DashboardListingItemNameForm({
  listingId,
  catalogProductName,
  requestItemName,
  readOnly = false,
  moderationPhrases = [],
  moderationStorefrontBlurb = null,
  moderationListingSearchKeywords = null,
}: ItemNameFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = effectiveListingItemDisplayName(requestItemName, catalogProductName);
  const [name, setName] = useState(initial);
  const baseline = useRef(initial);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const autosaveGen = useRef(0);

  useLayoutEffect(() => {
    autosaveGen.current += 1;
  }, [listingId]);

  useLayoutEffect(() => {
    const next = effectiveListingItemDisplayName(requestItemName, catalogProductName);
    setName(next);
    baseline.current = next;
  }, [listingId, catalogProductName, requestItemName]);

  useLayoutEffect(() => {
    setSavedFlash(false);
  }, [listingId]);

  const dirty = name.trim() !== baseline.current.trim();

  const runItemNameListingModerationScan = useCallback(() => {
    if (readOnly || moderationPhrases.length === 0) return;
    const by = listingModerationMatchesByFieldForUi({
      phrases: moderationPhrases,
      requestItemNameForHaystack: listingRequestItemNameForHaystack(name, catalogProductName),
      storefrontBlurbForHaystack: moderationStorefrontBlurb,
      searchKeywordsForHaystack: moderationListingSearchKeywords,
      itemNameVisible: name,
      blurbVisible: (moderationStorefrontBlurb ?? "").trim(),
      keywordsVisible: parseKeywordTokensFromStored(moderationListingSearchKeywords ?? "").join(" "),
    });
    setFieldError(by.itemName.length > 0 ? moderationTriggerErrorMessage(by.itemName) : null);
  }, [
    readOnly,
    moderationPhrases,
    name,
    catalogProductName,
    moderationStorefrontBlurb,
    moderationListingSearchKeywords,
  ]);

  useEffect(() => {
    if (dirty) {
      setSavedFlash(false);
      setFieldError(null);
    }
  }, [dirty]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    const gen = autosaveGen.current;
    const t = window.setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("listingId", listingId);
        fd.set("requestItemName", name);
        const r = await dashboardUpdateListingItemName(fd);
        if (gen !== autosaveGen.current) return;
        if (r.ok) {
          router.refresh();
          setFieldError(null);
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        } else {
          setFieldError(r.error);
        }
      });
    }, LISTING_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [readOnly, dirty, name, listingId, router]);

  if (readOnly) {
    const cat = catalogProductName.trim();
    const primary = initial.trim();
    const showCatalogSuffix = cat.length > 0 && cat !== primary;
    return (
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-medium text-zinc-200">{initial}</p>
          {showCatalogSuffix ? (
            <span className="text-xs text-zinc-500">{catalogProductName}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 w-full ${LISTING_FIELD_SAVE_ROW}`}>
      <label className={`${LISTING_FIELD_SAVE_PRIMARY} block text-xs text-zinc-500`}>
        Item name
        <input
          type="text"
          name="requestItemName"
          value={name}
          maxLength={REQUEST_ITEM_NAME_MAX}
          autoComplete="off"
          onChange={(ev) => setName(ev.target.value)}
          onBlur={runItemNameListingModerationScan}
          onFocus={runItemNameListingModerationScan}
          className="mt-1 block w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm font-medium text-zinc-100"
        />
        {fieldError ? (
          <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
            {fieldError}
          </p>
        ) : null}
      </label>
      <div className={LISTING_FIELD_SAVE_ACTION}>
        <ListingFieldAutoSaveStatus pending={pending} savedFlash={savedFlash} dirty={dirty} />
      </div>
    </div>
  );
}

type StorefrontBlurbFormProps = {
  listingId: string;
  catalogProductName: string;
  storefrontItemBlurb: string | null;
  readOnly?: boolean;
  moderationPhrases?: readonly string[];
  moderationRequestItemName?: string | null;
  moderationListingSearchKeywords?: string | null;
};

export function DashboardListingStorefrontBlurbForm({
  listingId,
  catalogProductName,
  storefrontItemBlurb,
  readOnly = false,
  moderationPhrases = [],
  moderationRequestItemName = null,
  moderationListingSearchKeywords = null,
}: StorefrontBlurbFormProps) {
  const storefrontBlurbFieldId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = storefrontItemBlurb?.trim() ?? "";
  const [text, setText] = useState(initial);
  const baseline = useRef(initial);
  const storefrontBlurbTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const autosaveGen = useRef(0);

  useLayoutEffect(() => {
    autosaveGen.current += 1;
  }, [listingId]);

  const adjustStorefrontBlurbHeight = useCallback(() => {
    const el = storefrontBlurbTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    const next = storefrontItemBlurb?.trim() ?? "";
    setText(next);
    baseline.current = next;
  }, [listingId, storefrontItemBlurb]);

  useLayoutEffect(() => {
    setSavedFlash(false);
  }, [listingId]);

  useLayoutEffect(() => {
    adjustStorefrontBlurbHeight();
  }, [text, adjustStorefrontBlurbHeight]);

  const dirty = text.trim() !== baseline.current.trim();

  const runStorefrontBlurbListingModerationScan = useCallback(() => {
    if (readOnly || moderationPhrases.length === 0) return;
    const blurbForHaystack = text.trim().length === 0 ? null : text.trim();
    const itemVisible = effectiveListingItemDisplayName(moderationRequestItemName, catalogProductName);
    const by = listingModerationMatchesByFieldForUi({
      phrases: moderationPhrases,
      requestItemNameForHaystack: listingRequestItemNameForHaystack(itemVisible, catalogProductName),
      storefrontBlurbForHaystack: blurbForHaystack,
      searchKeywordsForHaystack: moderationListingSearchKeywords,
      itemNameVisible: itemVisible,
      blurbVisible: text.trim(),
      keywordsVisible: parseKeywordTokensFromStored(moderationListingSearchKeywords ?? "").join(" "),
    });
    setFieldError(
      by.storefrontBlurb.length > 0 ? moderationTriggerErrorMessage(by.storefrontBlurb) : null,
    );
  }, [
    readOnly,
    moderationPhrases,
    text,
    catalogProductName,
    moderationRequestItemName,
    moderationListingSearchKeywords,
  ]);

  useEffect(() => {
    if (dirty) {
      setSavedFlash(false);
      setFieldError(null);
    }
  }, [dirty]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    const gen = autosaveGen.current;
    const t = window.setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("listingId", listingId);
        fd.set("storefrontItemBlurb", text);
        const r = await dashboardUpdateListingStorefrontBlurb(fd);
        if (gen !== autosaveGen.current) return;
        if (r.ok) {
          router.refresh();
          setFieldError(null);
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        } else {
          setFieldError(r.error);
        }
      });
    }, LISTING_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [readOnly, dirty, text, listingId, router]);

  if (readOnly) {
    return initial ? (
      <div className="mt-3 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">One liner</p>
        <p className="mt-1 text-sm italic leading-relaxed text-zinc-400">{initial}</p>
      </div>
    ) : null;
  }

  return (
    <div className="mt-3 w-full min-w-0 space-y-2">
      <div className="space-y-1">
        <label htmlFor={storefrontBlurbFieldId} className="block text-xs text-zinc-500">
          One liner
        </label>
        <div className={LISTING_FIELD_SAVE_ROW_CENTER}>
          <div className="mt-1 flex min-w-0 w-full items-stretch rounded border border-zinc-700 bg-zinc-900">
            <textarea
              ref={storefrontBlurbTextareaRef}
              id={storefrontBlurbFieldId}
              name="storefrontItemBlurb"
              value={text}
              maxLength={STOREFRONT_ITEM_BLURB_MAX}
              rows={1}
              autoComplete="off"
              onChange={(ev) => setText(ev.target.value)}
              onBlur={runStorefrontBlurbListingModerationScan}
              onFocus={runStorefrontBlurbListingModerationScan}
              className={`${LISTING_FIELD_SAVE_PRIMARY} min-h-0 min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent px-2 py-1.5 text-sm leading-snug text-zinc-100 outline-none focus:ring-0`}
            />
            <p
              className="m-0 flex shrink-0 items-center border-l border-zinc-800/90 px-2.5 text-right text-[11px] tabular-nums text-zinc-500"
              aria-live="polite"
              aria-label={`${text.length} of ${STOREFRONT_ITEM_BLURB_MAX} characters`}
            >
              {text.length}/{STOREFRONT_ITEM_BLURB_MAX}
            </p>
          </div>
          <div className={LISTING_FIELD_SAVE_ACTION}>
            <ListingFieldAutoSaveStatus pending={pending} savedFlash={savedFlash} dirty={dirty} />
          </div>
        </div>
        {fieldError ? (
          <p className="text-xs leading-snug text-red-300/90" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type SearchKeywordsFormProps = {
  listingId: string;
  catalogProductName: string;
  listingSearchKeywords: string | null;
  readOnly?: boolean;
  moderationPhrases?: readonly string[];
  moderationRequestItemName?: string | null;
  moderationStorefrontBlurb?: string | null;
};

export function DashboardListingSearchKeywordsForm({
  listingId,
  catalogProductName,
  listingSearchKeywords,
  readOnly = false,
  moderationPhrases = [],
  moderationRequestItemName = null,
  moderationStorefrontBlurb = null,
}: SearchKeywordsFormProps) {
  const keywordsFieldId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const rawInitial = listingSearchKeywords?.trim() ?? "";
  const initialJoined = parseKeywordTokensFromStored(rawInitial).join(" ");
  const [keywordTokens, setKeywordTokens] = useState(() => parseKeywordTokensFromStored(rawInitial));
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordDuplicateHint, setKeywordDuplicateHint] = useState<string | null>(null);
  const baseline = useRef(initialJoined);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const autosaveGen = useRef(0);

  useLayoutEffect(() => {
    autosaveGen.current += 1;
  }, [listingId]);

  const keywordsJoined = useMemo(() => keywordTokens.join(" "), [keywordTokens]);

  useLayoutEffect(() => {
    const raw = listingSearchKeywords?.trim() ?? "";
    const tokens = parseKeywordTokensFromStored(raw);
    const normalized = tokens.join(" ");
    setKeywordTokens(tokens);
    setKeywordDraft("");
    setKeywordDuplicateHint(null);
    baseline.current = normalized;
  }, [listingId, listingSearchKeywords]);

  useLayoutEffect(() => {
    setSavedFlash(false);
  }, [listingId]);

  const dirty = keywordsJoined.trim() !== baseline.current.trim();

  const runSearchKeywordsListingModerationScan = useCallback(() => {
    if (readOnly || moderationPhrases.length === 0) return;
    const kwParts = [keywordsJoined, keywordDraft.trim()].filter(Boolean);
    const kws = kwParts.length > 0 ? kwParts.join(" ") : null;
    const itemVisible = effectiveListingItemDisplayName(moderationRequestItemName, catalogProductName);
    const by = listingModerationMatchesByFieldForUi({
      phrases: moderationPhrases,
      requestItemNameForHaystack: listingRequestItemNameForHaystack(itemVisible, catalogProductName),
      storefrontBlurbForHaystack: moderationStorefrontBlurb,
      searchKeywordsForHaystack: kws,
      itemNameVisible: itemVisible,
      blurbVisible: (moderationStorefrontBlurb ?? "").trim(),
      keywordsVisible: kwParts.length > 0 ? kwParts.join(" ") : "",
    });
    setFieldError(by.keywords.length > 0 ? moderationTriggerErrorMessage(by.keywords) : null);
  }, [
    readOnly,
    moderationPhrases,
    keywordsJoined,
    keywordDraft,
    catalogProductName,
    moderationRequestItemName,
    moderationStorefrontBlurb,
  ]);

  useEffect(() => {
    if (dirty) {
      setSavedFlash(false);
      setFieldError(null);
    }
  }, [dirty]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    const gen = autosaveGen.current;
    const t = window.setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("listingId", listingId);
        fd.set("listingSearchKeywords", keywordsJoined);
        const r = await dashboardUpdateListingSearchKeywords(fd);
        if (gen !== autosaveGen.current) return;
        if (r.ok) {
          router.refresh();
          setFieldError(null);
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        } else {
          setFieldError(r.error);
        }
      });
    }, LISTING_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [readOnly, dirty, keywordsJoined, listingId, router]);

  if (readOnly) {
    return rawInitial ? (
      <div className="mt-3 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Keywords</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">{initialJoined || rawInitial}</p>
      </div>
    ) : null;
  }

  return (
    <div className="mt-3 w-full min-w-0 space-y-2">
      <div className="space-y-1">
        <label htmlFor={keywordsFieldId} className="block text-xs text-zinc-500">
          Keywords (optional, helps shoppers find this listing)
        </label>
        <ListingSearchKeywordsChipInput
          inputId={keywordsFieldId}
          disabled={pending}
          keywordTokens={keywordTokens}
          keywordDraft={keywordDraft}
          duplicateHint={keywordDuplicateHint}
          setKeywordTokens={setKeywordTokens}
          setKeywordDraft={setKeywordDraft}
          setDuplicateHint={setKeywordDuplicateHint}
          trailing={<ListingFieldAutoSaveStatus pending={pending} savedFlash={savedFlash} dirty={dirty} />}
          onGroupBlur={runSearchKeywordsListingModerationScan}
          onGroupFocus={runSearchKeywordsListingModerationScan}
        />
        {fieldError ? (
          <p className="text-xs leading-snug text-red-300/90" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type PriceFormProps = {
  listingId: string;
  priceDollarsFormatted: string;
  /** Unit goods/services COGS from admin baseline (same split as orders Shop Profit). */
  goodsServicesUnitCents?: number;
  product: {
    fulfillmentType: FulfillmentType;
    priceCents: number;
    minPriceCents: number;
    printifyVariantId: string | null;
  };
  readOnly?: boolean;
};

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, cents) / 100);
}

function listingSalePriceCents(
  priceDollarsStr: string,
  minPriceCents: number,
): number | null {
  const parsed = parseFloat(priceDollarsStr.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  if (cents < minPriceCents) return null;
  return cents;
}

function listingEstProfitLine(
  priceDollarsStr: string,
  minPriceCents: number,
  goodsServicesUnitCents: number,
): string | null {
  const cents = listingSalePriceCents(priceDollarsStr, minPriceCents);
  if (cents == null) return null;
  const profit = expectedShopProfitMerchandiseUnitCents({
    listPriceCents: cents,
    goodsServicesUnitCents,
  });
  return `Est. profit: ${formatUsdFromCents(profit)}`;
}

function ListingMerchandiseBreakdownRow({
  priceDollarsStr,
  minPriceCents,
  goodsServicesUnitCents,
  className = "mt-1.5",
}: {
  priceDollarsStr: string;
  minPriceCents: number;
  goodsServicesUnitCents: number;
  className?: string;
}) {
  const saleCents = listingSalePriceCents(priceDollarsStr, minPriceCents);
  if (saleCents == null) return null;
  const { goodsServicesCostCents, platformCutCents } = splitMerchandiseLineForCheckoutCents({
    lineMerchandiseCents: saleCents,
    goodsServicesLineCents: goodsServicesUnitCents,
  });
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[11px] text-zinc-500 tabular-nums ${className}`}
    >
      <span className="shrink-0">Sale {formatUsdFromCents(saleCents)}</span>
      <span className="shrink-0">Goods/services cost {formatUsdFromCents(goodsServicesCostCents)}</span>
      <span className="shrink-0">Platform fee {formatUsdFromCents(platformCutCents)}</span>
    </div>
  );
}

export function ListingEstProfitBreakdownHelp({
  profitLabel,
  priceDollarsStr,
  minPriceCents,
  goodsServicesUnitCents,
  layout = "field",
}: {
  profitLabel: string;
  priceDollarsStr: string;
  minPriceCents: number;
  goodsServicesUnitCents: number;
  /** `field` = inside bordered sale price row; `standalone` = below a plain price input */
  layout?: "field" | "standalone";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasBreakdown = listingSalePriceCents(priceDollarsStr, minPriceCents) != null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const profitText = (
    <p
      className={
        layout === "field"
          ? "m-0 text-right text-[11px] leading-snug text-blue-400/90"
          : "m-0 text-blue-400/90"
      }
    >
      {profitLabel}
    </p>
  );

  const helpButton = hasBreakdown ? (
    <button
      type="button"
      aria-label="Show sale breakdown"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-[10px] font-semibold leading-none text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
    >
      ?
    </button>
  ) : null;

  const popup =
    open && hasBreakdown ? (
      <div
        role="tooltip"
        className={`absolute z-30 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 shadow-lg ${
          layout === "field"
            ? "right-0 top-full mt-1.5 text-right"
            : "left-full top-1/2 ml-1.5 -translate-y-1/2 text-left"
        }`}
      >
        <ListingMerchandiseBreakdownRow
          priceDollarsStr={priceDollarsStr}
          minPriceCents={minPriceCents}
          goodsServicesUnitCents={goodsServicesUnitCents}
          className={layout === "field" ? "flex-col items-end gap-1" : "flex-col items-start gap-1"}
        />
      </div>
    ) : null;

  if (layout === "standalone") {
    return (
      <div ref={rootRef} className="inline-flex items-center">
        {profitText}
        {helpButton ? (
          <div className="relative ml-1.5 inline-block shrink-0">
            {helpButton}
            {popup}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 shrink-0 items-center border-l border-zinc-800/90 px-2.5 py-1.5"
    >
      {profitText}
      {helpButton ? <span className="ml-1.5 shrink-0">{helpButton}</span> : null}
      {popup}
    </div>
  );
}

function MerchandiseBreakdownCentsRow({
  saleCents,
  goodsServicesCostCents,
  platformCutCents,
  className = "flex-col items-end gap-1",
}: {
  saleCents: number;
  goodsServicesCostCents: number;
  platformCutCents: number;
  className?: string;
}) {
  return (
    <div className={`flex text-[11px] text-zinc-500 tabular-nums ${className}`}>
      <span className="shrink-0">Sale {formatUsdFromCents(saleCents)}</span>
      <span className="shrink-0">Goods/services cost {formatUsdFromCents(goodsServicesCostCents)}</span>
      <span className="shrink-0">Platform fee {formatUsdFromCents(platformCutCents)}</span>
    </div>
  );
}

/** Orders tab: one-line shop profit with ? popup (order-level merchandise totals). */
export function PaidOrderShopProfitHelp({
  shopProfitCents,
  saleCents,
  goodsServicesCostCents,
  platformCutCents,
}: {
  shopProfitCents: number;
  saleCents: number;
  goodsServicesCostCents: number;
  platformCutCents: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const showHelp = saleCents > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0 items-center justify-center leading-snug">
      <span className="text-[11px] tabular-nums leading-snug text-zinc-100">
        {formatUsdFromCents(shopProfitCents)}
      </span>
      {showHelp ? (
        <div className="relative ml-1.5 inline-block shrink-0">
          <button
            type="button"
            aria-label="Show order profit breakdown"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-[10px] font-semibold leading-none text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            ?
          </button>
          {open ? (
            <div
              role="tooltip"
              className="absolute right-0 top-full z-30 mt-1.5 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-right shadow-lg"
            >
              <MerchandiseBreakdownCentsRow
                saleCents={saleCents}
                goodsServicesCostCents={goodsServicesCostCents}
                platformCutCents={platformCutCents}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardListingPriceForm({
  listingId,
  priceDollarsFormatted,
  goodsServicesUnitCents = 0,
  product,
  readOnly = false,
}: PriceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(priceDollarsFormatted);
  const baseline = useRef(priceDollarsFormatted);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const autosaveGen = useRef(0);

  useLayoutEffect(() => {
    autosaveGen.current += 1;
  }, [listingId]);

  useLayoutEffect(() => {
    setPrice(priceDollarsFormatted);
    baseline.current = priceDollarsFormatted;
  }, [listingId, priceDollarsFormatted]);

  useLayoutEffect(() => {
    setSavedFlash(false);
    setSaveError(null);
  }, [listingId]);

  const dirtySingle = price.trim() !== baseline.current.trim();
  const dirty = dirtySingle;

  useEffect(() => {
    if (dirty) setSavedFlash(false);
  }, [dirty]);

  useEffect(() => {
    if (readOnly || !dirtySingle) return;
    const gen = autosaveGen.current;
    const t = window.setTimeout(() => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("listingId", listingId);
        fd.set("priceDollars", price);
        const r = await dashboardUpdateListingPrice(fd);
        if (gen !== autosaveGen.current) return;
        if (r.ok) {
          setSaveError(null);
          router.refresh();
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 2500);
        } else {
          setSaveError(r.error ?? "Could not save price.");
        }
      });
    }, LISTING_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [readOnly, dirtySingle, price, listingId, router]);

  if (readOnly) {
    return null;
  }

  const enteredListPriceCents = (() => {
    const parsed = parseFloat(price.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
  })();
  const showMaxListPriceCapHint =
    enteredListPriceCents != null && enteredListPriceCents > SHOP_LISTING_MAX_PRICE_CENTS;

  const singleFloorCents = printifyVariantShopFloorCents(product);
  const singleProfitLine = listingEstProfitLine(price, singleFloorCents, goodsServicesUnitCents);

  return (
    <div className="mt-3 min-w-0 w-full space-y-2">
      <div className={`min-w-0 w-full ${LISTING_FIELD_SAVE_ROW}`}>
        <label className={`${LISTING_FIELD_SAVE_PRIMARY} block text-xs text-zinc-500`}>
          Sale Price
          <div className="mt-1 flex w-full min-w-0 items-stretch rounded border border-zinc-700 bg-zinc-900">
            <input
              type="text"
              name="priceDollars"
              value={price}
              autoComplete="off"
              onChange={(ev) => {
                setSaveError(null);
                setPrice(ev.target.value);
              }}
              className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm leading-snug text-zinc-100 outline-none focus:ring-0"
            />
            <ListingEstProfitBreakdownHelp
              profitLabel={singleProfitLine ?? "Est. profit: —"}
              priceDollarsStr={price}
              minPriceCents={singleFloorCents}
              goodsServicesUnitCents={goodsServicesUnitCents}
            />
          </div>
        </label>
        <div className={LISTING_FIELD_SAVE_ACTION}>
          <ListingFieldAutoSaveStatus pending={pending} savedFlash={savedFlash} dirty={dirtySingle} />
        </div>
      </div>
      {showMaxListPriceCapHint ? (
        <p className="text-[11px] text-zinc-600">Maximum list price {shopListingMaxPriceUsdLabel()} per listing.</p>
      ) : null}
      {saveError ? (
        <p className="text-xs leading-snug text-red-300/90" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

type SubmitRequestFormProps = {
  listingId: string;
  defaultImageUrlsText: string;
  /** When true, listing credits are required before submit (server also enforces). */
  feeBlocksSubmit?: boolean;
  /** When true, shop already has the max in-review listing requests. */
  inReviewBlocksSubmit?: boolean;
};

export function DashboardSubmitListingRequestForm({
  listingId,
  defaultImageUrlsText,
  feeBlocksSubmit = false,
  inReviewBlocksSubmit = false,
}: SubmitRequestFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(defaultImageUrlsText);
  const [savedFlash, setSavedFlash] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attestationOpen, setAttestationOpen] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const pendingFdRef = useRef<FormData | null>(null);

  useLayoutEffect(() => {
    setText(defaultImageUrlsText);
    setSavedFlash(false);
    setSubmitError(null);
  }, [listingId, defaultImageUrlsText]);

  useEffect(() => {
    if (attestationOpen) {
      setAttestationChecked(false);
    }
  }, [attestationOpen]);

  const hasUrls = text.trim().length > 0;

  const submitBlocked = feeBlocksSubmit || inReviewBlocksSubmit;

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!hasUrls || pending || submitBlocked) return;
      const fd = new FormData(e.currentTarget);
      pendingFdRef.current = fd;
      setAttestationOpen(true);
    },
    [hasUrls, pending, submitBlocked],
  );

  const label = pending
    ? "Saving..."
    : savedFlash
      ? "Saved"
      : "Submit for admin approval";
  const btnClass = pending
    ? savingSave
    : !hasUrls
      ? disabledSave
      : savedFlash
        ? savedSave
        : activeSave;

  return (
    <>
      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <input type="hidden" name="listingId" value={listingId} />
        <label className="block text-xs text-zinc-500">
          Reference image URLs (one per line) for admin review
          <textarea
            name="requestImageUrls"
            rows={3}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200"
          />
        </label>
        <button
          type="submit"
          disabled={!hasUrls || pending || savedFlash || submitBlocked}
          className={btnClass}
        >
          {label}
        </button>
      </form>

      {inReviewBlocksSubmit ? (
        <p className="mt-2 text-xs leading-snug text-amber-200/85" role="status">
          {shopInReviewListingRequestLimitError()}
        </p>
      ) : null}

      {feeBlocksSubmit ? (
        <p className="mt-2 text-xs leading-snug text-amber-200/85" role="status">
          Buy listing credits on the{" "}
          <a href="/dashboard?dash=requestListing" className="text-amber-100 underline-offset-2 hover:underline">
            Request listing
          </a>{" "}
          tab before you can submit for admin review.
        </p>
      ) : null}
      {submitError ? (
        <p className="mt-2 text-xs leading-snug text-red-300/90" role="alert">
          {submitError}
        </p>
      ) : null}

      {attestationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-listing-attestation-title"
        >
          <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
            <h3 id="dash-listing-attestation-title" className="text-base font-semibold text-zinc-100">
              Confirm listing request
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              You are about to submit these reference URLs for admin review.
            </p>
            <label className="mt-4 flex cursor-pointer gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={attestationChecked}
                onChange={(e) => setAttestationChecked(e.target.checked)}
                className="mt-1 shrink-0 rounded border-zinc-600"
              />
              <span>
                I have the rights to the photos referenced above, and they follow the{" "}
                <a
                  href="/shop-regulations"
                  className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  shop regulations
                </a>
                .
              </span>
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => {
                  setAttestationOpen(false);
                  pendingFdRef.current = null;
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!attestationChecked || pending || submitBlocked}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  const fd = pendingFdRef.current;
                  if (!fd || !attestationChecked || submitBlocked) return;
                  fd.set("guidelinesAttestation", "1");
                  setAttestationOpen(false);
                  pendingFdRef.current = null;
                  startTransition(async () => {
                    const r: DashboardSubmitListingRequestResult =
                      await dashboardSubmitListingRequest(fd);
                    if (r.ok) {
                      router.refresh();
                      setSubmitError(null);
                      setSavedFlash(true);
                      window.setTimeout(() => setSavedFlash(false), 2500);
                    } else {
                      setSubmitError(r.error ?? "Could not submit for review. Try again.");
                    }
                  });
                }}
              >
                Submit for admin approval
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type SupplementPhotoFormProps = {
  listingId: string;
  ownerSupplementImageUrl: string | null;
  ownerSupplementPendingImageUrl: string | null;
  ownerSupplementPendingSubmittedAtIso?: string | null;
  r2Configured: boolean;
  /** When false, show current image only (e.g. admin-frozen listing). */
  canEdit: boolean;
  /** Omit section chrome when laid out beside storefront catalog images. */
  embedded?: boolean;
};

/** Same public URL after R2 replace — append a version so the browser fetches new bytes. */
function supplementThumbDisplaySrc(publicUrl: string, bust: number): string {
  const u = publicUrl.trim();
  if (!u || bust === 0) return u;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${bust}`;
}

export function DashboardListingSupplementPhotoForm({
  listingId,
  ownerSupplementImageUrl,
  ownerSupplementPendingImageUrl,
  ownerSupplementPendingSubmittedAtIso,
  r2Configured,
  canEdit,
  embedded = false,
}: SupplementPhotoFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [transitionPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ownerSupplementImgBust, setOwnerSupplementImgBust] = useState(0);
  const [pendingPreviewBust, setPendingPreviewBust] = useState(0);

  const liveTrim = ownerSupplementImageUrl?.trim() ?? "";
  const pendingTrim = ownerSupplementPendingImageUrl?.trim() ?? "";

  useLayoutEffect(() => {
    setMessage(null);
    setHasFile(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [listingId, liveTrim, pendingTrim]);

  useEffect(() => {
    setOwnerSupplementImgBust(0);
    setPendingPreviewBust(0);
  }, [listingId]);

  const uploadLabel = transitionPending ? "Uploading…" : "Submit image for review";
  const uploadClass = transitionPending
    ? savingSave
    : !hasFile
      ? disabledSave
      : activeSave;

  const shellClass = embedded
    ? "flex h-full min-h-0 min-w-0 flex-1 flex-col"
    : "mt-4 border-t border-zinc-800 pt-4";

  const introClass = embedded ? "shrink-0 space-y-1" : "space-y-1";

  const uploadRow =
    canEdit && r2Configured && !pendingTrim ? (
      <div className={embedded ? "flex flex-wrap items-end gap-2" : "mt-2 flex flex-wrap items-end gap-2"}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => setHasFile(Boolean(e.target.files?.length))}
          className="max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
        />
        <button
          type="button"
          disabled={!hasFile || transitionPending}
          className={uploadClass}
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file || transitionPending) return;
            const fd = new FormData();
            fd.set("listingId", listingId);
            fd.set("supplementPhoto", file);
            startTransition(async () => {
              setMessage(null);
              const r = await dashboardUploadListingSupplementPhoto(fd);
              if (r.ok) {
                await router.refresh();
                setOwnerSupplementImgBust(Date.now());
                setPendingPreviewBust(Date.now());
              } else {
                setMessage(r.error);
              }
              if (fileRef.current) fileRef.current.value = "";
              if (r.ok) setHasFile(false);
            });
          }}
        >
          {uploadLabel}
        </button>
      </div>
    ) : null;

  return (
    <div className={shellClass}>
      <div className={introClass}>
        <p className="text-xs font-medium text-zinc-500">Custom primary image (optional)</p>
        <p className={embedded ? "text-[11px] leading-snug text-zinc-600" : "mt-1 text-[11px] text-zinc-600"}>
          One custom image per listing. New uploads are reviewed by the platform before they appear on your public
          shop. We recommend a &quot;context&quot; photo with the product in scene.
        </p>
      </div>
      {embedded ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="mt-0 flex flex-1 flex-col items-stretch gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Live on storefront</p>
            {liveTrim ? (
              <span className={`group ${LISTING_EMBEDDED_PREVIEW_FRAME}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={supplementThumbDisplaySrc(liveTrim, ownerSupplementImgBust)}
                  alt=""
                  className={LISTING_EMBEDDED_PREVIEW_IMG}
                />
              </span>
            ) : (
              <span className={LISTING_EMBEDDED_PREVIEW_PLACEHOLDER} aria-hidden />
            )}
            {liveTrim && canEdit ? (
              <form
                className="shrink-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (transitionPending) return;
                  const fd = new FormData();
                  fd.set("listingId", listingId);
                  startTransition(async () => {
                    setMessage(null);
                    const r = await dashboardClearListingSupplementPhoto(fd);
                    router.refresh();
                    if (!r.ok) setMessage(r.error);
                  });
                }}
              >
                <button
                  type="submit"
                  disabled={transitionPending}
                  className="w-full rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                >
                  Remove live custom photo
                </button>
              </form>
            ) : null}
          </div>
          {pendingTrim ? (
            <div className="flex flex-col gap-2 rounded border border-amber-900/35 bg-amber-950/20 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">Pending admin review</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={supplementThumbDisplaySrc(pendingTrim, pendingPreviewBust)}
                alt=""
                className="mx-auto max-h-32 max-w-full rounded border border-zinc-700 object-contain"
              />
              {ownerSupplementPendingSubmittedAtIso ? (
                <p className="text-center text-[10px] text-zinc-500">
                  Submitted {formatDisplayedDateTime(ownerSupplementPendingSubmittedAtIso)}
                </p>
              ) : null}
              {canEdit ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (transitionPending) return;
                    if (!window.confirm(supplementPendingWithdrawConfirmMessage)) return;
                    const fd = new FormData();
                    fd.set("listingId", listingId);
                    startTransition(async () => {
                      setMessage(null);
                      const r = await dashboardWithdrawListingSupplementPending(fd);
                      router.refresh();
                      if (!r.ok) setMessage(r.error);
                    });
                  }}
                >
                  <button
                    type="submit"
                    disabled={transitionPending}
                    className="w-full rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  >
                    Withdraw pending image
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
          {!canEdit ? (
            <p className="text-[11px] text-zinc-600">Uploads disabled while this listing is frozen.</p>
          ) : !r2Configured ? (
            <p className="text-xs text-amber-200/80">
              R2 uploads are not configured on this server — contact the platform operator.
            </p>
          ) : (
            uploadRow
          )}
          {message ? <p className="mt-2 text-xs text-red-300/90">{message}</p> : null}
        </div>
      ) : (
        <>
          <div className="mt-2 space-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Live on storefront</p>
              <div className="mt-1 flex flex-col items-start gap-2">
                {liveTrim ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={supplementThumbDisplaySrc(liveTrim, ownerSupplementImgBust)}
                    alt=""
                    className="h-20 w-20 rounded border border-zinc-700 object-cover"
                  />
                ) : (
                  <div className={LISTING_SUPPLEMENT_PREVIEW_PLACEHOLDER} aria-hidden />
                )}
                {liveTrim && canEdit ? (
                  <form
                    className="shrink-0"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (transitionPending) return;
                      const fd = new FormData();
                      fd.set("listingId", listingId);
                      startTransition(async () => {
                        setMessage(null);
                        const r = await dashboardClearListingSupplementPhoto(fd);
                        router.refresh();
                        if (!r.ok) setMessage(r.error);
                      });
                    }}
                  >
                    <button
                      type="submit"
                      disabled={transitionPending}
                      className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    >
                      Remove live custom photo
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
            {pendingTrim ? (
              <div className="rounded border border-amber-900/35 bg-amber-950/20 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
                  Pending admin review
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={supplementThumbDisplaySrc(pendingTrim, pendingPreviewBust)}
                  alt=""
                  className="mt-2 h-20 w-20 rounded border border-zinc-700 object-cover"
                />
                {ownerSupplementPendingSubmittedAtIso ? (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Submitted {formatDisplayedDateTime(ownerSupplementPendingSubmittedAtIso)}
                  </p>
                ) : null}
                {canEdit ? (
                  <form
                    className="mt-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (transitionPending) return;
                      if (!window.confirm(supplementPendingWithdrawConfirmMessage)) return;
                      const fd = new FormData();
                      fd.set("listingId", listingId);
                      startTransition(async () => {
                        setMessage(null);
                        const r = await dashboardWithdrawListingSupplementPending(fd);
                        router.refresh();
                        if (!r.ok) setMessage(r.error);
                      });
                    }}
                  >
                    <button
                      type="submit"
                      disabled={transitionPending}
                      className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    >
                      Withdraw pending image
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
          {!canEdit ? (
            <p className="mt-2 text-[11px] text-zinc-600">Uploads disabled while this listing is frozen.</p>
          ) : !r2Configured ? (
            <p className="mt-2 text-xs text-amber-200/80">
              R2 uploads are not configured on this server — contact the platform operator.
            </p>
          ) : (
            uploadRow
          )}
          {message ? <p className="mt-2 text-xs text-red-300/90">{message}</p> : null}
        </>
      )}
    </div>
  );
}

const initialCatalogImagesForm: ListingCatalogImagesFormState = {
  ok: false,
  error: null,
};

const supplementPendingWithdrawConfirmMessage =
  "Withdraw this pending image? It will be removed from review and deleted from storage.";

/** All selectable images: catalogue first, then optional owner upload (default hero stays catalogue until chosen). */
function embeddedPairCandidates(ownerTrim: string, catalogUrls: string[]): string[] {
  const o = ownerTrim.trim();
  return [...catalogUrls, ...(o ? [o] : [])];
}

/** First saved URL is the storefront hero; if unset, first catalogue image, else sole custom image. */
function embeddedPairInitialHero(ownerTrim: string, catalogUrls: string[], saved: string[] | null): string {
  const candidates = embeddedPairCandidates(ownerTrim, catalogUrls);
  if (candidates.length === 0) return "";
  if (saved !== null && saved.length > 0) {
    const wantKey = catalogImageUrlKey(saved[0]!.trim());
    for (const c of candidates) {
      if (catalogImageUrlKey(c) === wantKey) return c;
    }
  }
  return candidates[0]!;
}

/** Hero image first, then every other candidate (full gallery; hero is the listing primary). */
function embeddedPairOrderedHeroFirst(hero: string, candidates: string[]): string[] {
  if (candidates.length === 0) return [];
  const hk = hero.trim() ? catalogImageUrlKey(hero) : "";
  const heroCanon = candidates.find((c) => catalogImageUrlKey(c) === hk) ?? candidates[0]!;
  const rest = candidates.filter((c) => catalogImageUrlKey(c) !== catalogImageUrlKey(heroCanon));
  return [heroCanon, ...rest];
}

/** Custom photo + catalog pickers: choose exactly one hero image; gallery order is hero first, then the rest. */
export function ListingEmbeddedSupplementCatalogPair({
  listingId,
  ownerSupplementImageUrl,
  ownerSupplementPendingImageUrl,
  catalogUrls,
  savedCatalogSelection,
  canEdit,
  r2Configured,
}: {
  listingId: string;
  ownerSupplementImageUrl: string;
  ownerSupplementPendingImageUrl?: string;
  catalogUrls: string[];
  savedCatalogSelection: string[] | null;
  canEdit: boolean;
  r2Configured: boolean;
}) {
  const router = useRouter();
  const supplementFileId = useId();
  const withdrawDialogTitleId = useId();
  const supplementFileRef = useRef<HTMLInputElement>(null);
  const [subsetPending, startSubset] = useTransition();
  const [subsetOk, setSubsetOk] = useState(false);
  const [subsetError, setSubsetError] = useState<string | null>(null);
  const [clearPending, startClear] = useTransition();
  const [uploadPending, startUpload] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ownerSupplementImgBust, setOwnerSupplementImgBust] = useState(0);
  const [pendingPreviewBust, setPendingPreviewBust] = useState(0);
  const [withdrawPending, startWithdraw] = useTransition();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const ownerTrim = ownerSupplementImageUrl.trim();
  const pendingTrim = (ownerSupplementPendingImageUrl ?? "").trim();

  const candidates = useMemo(
    () => embeddedPairCandidates(ownerTrim, catalogUrls),
    [ownerTrim, catalogUrls],
  );
  const heroRadioGroup = `listing-hero-${listingId}`;

  const [heroUrl, setHeroUrl] = useState(() =>
    embeddedPairInitialHero(ownerTrim, catalogUrls, savedCatalogSelection),
  );
  const committedMediaKeyRef = useRef(
    embeddedPairOrderedHeroFirst(
      embeddedPairInitialHero(ownerTrim, catalogUrls, savedCatalogSelection),
      embeddedPairCandidates(ownerTrim, catalogUrls),
    ).join("\0"),
  );
  const saveGenRef = useRef(0);
  const catalogSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const h = embeddedPairInitialHero(ownerTrim, catalogUrls, savedCatalogSelection);
    const c = embeddedPairCandidates(ownerTrim, catalogUrls);
    setHeroUrl(h);
    committedMediaKeyRef.current = embeddedPairOrderedHeroFirst(h, c).join("\0");
  }, [listingId, ownerTrim, catalogUrls, savedCatalogSelection]);

  useEffect(() => {
    setSubsetOk(false);
    setSubsetError(null);
    setMessage(null);
    setOwnerSupplementImgBust(0);
    setPendingPreviewBust(0);
    setWithdrawDialogOpen(false);
  }, [listingId]);

  useEffect(() => {
    if (!withdrawDialogOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setWithdrawDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [withdrawDialogOpen]);

  useEffect(() => {
    return () => {
      if (catalogSaveDebounceRef.current) clearTimeout(catalogSaveDebounceRef.current);
    };
  }, []);

  const runSupplementUpload = useCallback(
    (file: File) => {
      startUpload(async () => {
        setMessage(null);
        const fd = new FormData();
        fd.set("listingId", listingId);
        fd.set("supplementPhoto", file);
        const r = await dashboardUploadListingSupplementPhoto(fd);
        if (r.ok) {
          await router.refresh();
          setOwnerSupplementImgBust(Date.now());
          setPendingPreviewBust(Date.now());
        } else {
          setMessage(r.error);
        }
        if (supplementFileRef.current) supplementFileRef.current.value = "";
      });
    },
    [listingId, router],
  );

  const runWithdrawPending = useCallback(() => {
    if (withdrawPending) return;
    const fd = new FormData();
    fd.set("listingId", listingId);
    startWithdraw(async () => {
      setMessage(null);
      const r = await dashboardWithdrawListingSupplementPending(fd);
      router.refresh();
      if (!r.ok) setMessage(r.error);
    });
  }, [listingId, router, withdrawPending, startWithdraw]);

  const scheduleCatalogAutosave = useCallback(
    (orderedUrls: string[]) => {
      const key = orderedUrls.join("\0");
      if (key === committedMediaKeyRef.current) return;
      if (orderedUrls.length === 0) return;

      if (catalogSaveDebounceRef.current) clearTimeout(catalogSaveDebounceRef.current);
      catalogSaveDebounceRef.current = setTimeout(() => {
        catalogSaveDebounceRef.current = null;
        startSubset(async () => {
          const myGen = ++saveGenRef.current;
          setSubsetError(null);
          const fd = new FormData();
          fd.set("listingId", listingId);
          fd.set("mode", "subset");
          for (const u of orderedUrls) fd.append("catalogUrl", u);
          const r = await dashboardSetListingStorefrontCatalogImagesForm(initialCatalogImagesForm, fd);
          if (myGen !== saveGenRef.current) return;
          if (r.ok) {
            committedMediaKeyRef.current = key;
            setSubsetOk(true);
            router.refresh();
            window.setTimeout(() => setSubsetOk(false), 2000);
          } else {
            setSubsetError(r.error);
          }
        });
      }, 120);
    },
    [listingId, router],
  );

  const isHero = (u: string) => catalogImageUrlKey(heroUrl) === catalogImageUrlKey(u);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:h-full">
        <div className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">Listing Images</p>
        <p className="text-[11px] leading-snug text-zinc-600">
          One custom image per listing (ex. image in a scene)
        </p>
        <p className="text-[11px] leading-snug text-zinc-600">Select which image will be primary.</p>
      </div>

      <div
        className="mt-4 min-w-0 flex-1 space-y-2"
        aria-busy={subsetPending || uploadPending || clearPending || withdrawPending}
      >
        <div
          className="flex flex-wrap items-start justify-start gap-x-6 gap-y-4"
          role="group"
          aria-label="Listing images"
        >
          <div className="flex w-[5.375rem] shrink-0 flex-col items-center gap-2 text-center">
            <div className="flex h-7 w-full max-w-[5.375rem] shrink-0 items-center justify-center">
              {pendingTrim && !ownerTrim ? (
                <div className="w-full rounded border border-amber-900/40 bg-amber-950/25 px-1.5 py-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/85">
                    In review
                  </p>
                </div>
              ) : (
                <p className="text-xs font-medium text-zinc-500">Your upload</p>
              )}
            </div>
            {ownerTrim ? (
              <label
                className={`group relative block w-[5.375rem] shrink-0 ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}
              >
                <input
                  type="radio"
                  name={heroRadioGroup}
                  value={ownerTrim}
                  checked={isHero(ownerTrim)}
                  disabled={!canEdit}
                  onChange={() => {
                    if (!canEdit) return;
                    setHeroUrl(ownerTrim);
                    scheduleCatalogAutosave(embeddedPairOrderedHeroFirst(ownerTrim, candidates));
                  }}
                  className="peer sr-only"
                  aria-label="Use custom upload as primary storefront image"
                />
                <span className={LISTING_EMBEDDED_PREVIEW_FRAME_SELECTABLE}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={supplementThumbDisplaySrc(ownerSupplementImageUrl, ownerSupplementImgBust)}
                    alt=""
                    className={LISTING_EMBEDDED_PREVIEW_IMG}
                  />
                </span>
              </label>
            ) : pendingTrim ? null : (
              <span className={LISTING_EMBEDDED_PREVIEW_PLACEHOLDER} aria-hidden />
            )}
            {canEdit && ownerTrim ? (
              <form
                className={`w-full max-w-[5.375rem] shrink-0 ${LISTING_EMBEDDED_THUMB_CONTROL}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (clearPending) return;
                  const fd = new FormData();
                  fd.set("listingId", listingId);
                  startClear(async () => {
                    setMessage(null);
                    const r = await dashboardClearListingSupplementPhoto(fd);
                    router.refresh();
                    if (!r.ok) setMessage(r.error);
                  });
                }}
              >
                <button
                  type="submit"
                  disabled={clearPending}
                  className="w-full text-[10px] leading-tight text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-40"
                >
                  Remove live photo
                </button>
              </form>
            ) : null}
            {pendingTrim ? (
              <div className="w-full max-w-[5.375rem] text-left">
                <span className={LISTING_EMBEDDED_PREVIEW_FRAME}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={supplementThumbDisplaySrc(pendingTrim, pendingPreviewBust)}
                    alt=""
                    className={LISTING_EMBEDDED_PREVIEW_IMG}
                  />
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={withdrawPending}
                    className="mt-1 w-full text-[9px] leading-tight text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-40"
                    onClick={() => setWithdrawDialogOpen(true)}
                  >
                    Withdraw
                  </button>
                ) : null}
              </div>
            ) : null}
            {canEdit ? (
              <>
                {!pendingTrim && r2Configured ? (
                  <>
                    <input
                      ref={supplementFileRef}
                      id={supplementFileId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={uploadPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || uploadPending) return;
                        runSupplementUpload(file);
                      }}
                    />
                    <label
                      htmlFor={supplementFileId}
                      className={`block w-full max-w-[5.375rem] cursor-pointer rounded border border-zinc-700 bg-zinc-900/40 px-1.5 py-1 text-center text-[10px] leading-tight text-zinc-200 hover:border-zinc-500 ${uploadPending ? "pointer-events-none opacity-60" : ""}`}
                    >
                      {uploadPending ? "Uploading…" : "Choose file"}
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <p className="max-w-[5.375rem] text-[11px] text-zinc-600">Uploads disabled while this listing is frozen.</p>
            )}
          </div>
          <div
            className="flex flex-wrap items-start justify-start gap-x-6 gap-y-4"
            role="radiogroup"
            aria-label="Catalogue images as primary"
          >
            {catalogUrls.map((url) => (
              <div key={url} className="flex w-[5.375rem] shrink-0 flex-col items-center gap-2 text-center">
                <div className="flex h-7 w-full max-w-[5.375rem] shrink-0 items-center justify-center">
                  <p className="text-xs font-medium text-zinc-500">Catalogue Image</p>
                </div>
                <label
                  className={`group relative block w-[5.375rem] shrink-0 ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}
                >
                  <input
                    type="radio"
                    name={heroRadioGroup}
                    value={url}
                    checked={isHero(url)}
                    disabled={!canEdit}
                    onChange={() => {
                      if (!canEdit) return;
                      setHeroUrl(url);
                      scheduleCatalogAutosave(embeddedPairOrderedHeroFirst(url, candidates));
                    }}
                    className="peer sr-only"
                    aria-label="Use catalogue image as primary storefront image"
                  />
                  <span className={LISTING_EMBEDDED_PREVIEW_FRAME_SELECTABLE}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className={LISTING_EMBEDDED_PREVIEW_IMG} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
        {subsetPending ? (
          <p className="text-[11px] text-zinc-500" role="status">
            Saving…
          </p>
        ) : subsetOk ? (
          <p className="text-[11px] text-emerald-400/90" role="status">
            Saved
          </p>
        ) : null}
        {subsetError ? (
          <p className="text-xs text-red-400/95" role="alert">
            {subsetError}
          </p>
        ) : null}
      </div>

      {!canEdit ? null : !r2Configured ? (
        <p className="mt-2 text-xs text-amber-200/80">
          R2 uploads are not configured on this server — contact the platform operator.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-red-300/90">{message}</p> : null}

      {withdrawDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={withdrawDialogTitleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) setWithdrawDialogOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={withdrawDialogTitleId} className="text-sm font-semibold text-zinc-100">
              Withdraw photo review?
            </h3>
            <p className="mt-2 text-xs leading-snug text-zinc-400">
              Are you sure you want to remove this image request?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-zinc-600 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500"
                onClick={() => setWithdrawDialogOpen(false)}
              >
                No
              </button>
              <button
                type="button"
                disabled={withdrawPending}
                className="rounded border border-red-900/55 bg-red-950/35 px-3 py-1.5 text-xs font-medium text-red-200/95 hover:border-red-700/60 disabled:opacity-40"
                onClick={() => {
                  setWithdrawDialogOpen(false);
                  runWithdrawPending();
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ListingStorefrontCatalogImagesForms({
  listingId,
  catalogUrls,
  savedCatalogSelection,
  embedded = false,
}: {
  listingId: string;
  catalogUrls: string[];
  savedCatalogSelection: string[] | null;
  /** Omit section chrome when laid out beside custom primary image. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [subsetPending, startSubset] = useTransition();
  const [subsetOk, setSubsetOk] = useState(false);
  const [subsetError, setSubsetError] = useState<string | null>(null);

  useEffect(() => {
    setSubsetOk(false);
    setSubsetError(null);
  }, [listingId]);

  const handleSubset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    startSubset(async () => {
      setSubsetError(null);
      const fd = new FormData(form);
      const r = await dashboardSetListingStorefrontCatalogImagesForm(initialCatalogImagesForm, fd);
      if (r.ok) {
        setSubsetOk(true);
        router.refresh();
        window.setTimeout(() => setSubsetOk(false), 2500);
      } else {
        setSubsetError(r.error);
      }
    });
  };

  const subsetLabel = subsetPending ? "Saving…" : subsetOk ? "Saved" : "Save image selection";
  const subsetBtnClass = subsetPending ? savingSave : subsetOk ? savedSave : activeSave;

  const shellClass = embedded
    ? "flex h-full min-h-0 min-w-0 flex-1 flex-col"
    : "mt-4 border-t border-zinc-800 pt-4";

  const introClass = embedded ? "shrink-0 space-y-1" : undefined;

  if (catalogUrls.length === 0) {
    if (!embedded) {
      return (
        <div className={shellClass}>
          <p className="text-xs font-medium text-zinc-500">Listing primary image</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Only one catalog image is available; it always appears on your product page.
          </p>
        </div>
      );
    }
    return (
      <div className={shellClass}>
        <div className={introClass}>
          <p className="text-xs font-medium text-zinc-500">Listing primary image</p>
          <p className="text-[11px] leading-snug text-zinc-600">
            Only one catalog image is available; it always appears on your product page.
          </p>
        </div>
      </div>
    );
  }

  const formBlock = (
    <form
      onSubmit={handleSubset}
      className={`${embedded ? "mt-0 flex min-h-0 flex-1 flex-col" : "mt-2"} space-y-3`}
    >
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="mode" value="subset" />
        <div
          className={
            embedded
              ? "flex min-h-0 flex-1 flex-wrap content-start gap-2"
              : "grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5rem,1fr))]"
          }
        >
          {catalogUrls.map((url) => (
            <label
              key={url}
              className={`group relative block cursor-pointer ${embedded ? "w-[5.375rem] shrink-0" : ""}`}
            >
              <input
                type="checkbox"
                name="catalogUrl"
                value={url}
                defaultChecked={
                  savedCatalogSelection === null ? true : savedCatalogSelection.includes(url)
                }
                className="peer sr-only"
              />
              <span
                className={
                  embedded
                    ? LISTING_EMBEDDED_PREVIEW_FRAME_SELECTABLE
                    : "block overflow-hidden rounded-lg border border-zinc-700/90 bg-zinc-900/40 ring-2 ring-transparent ring-offset-2 ring-offset-zinc-950 transition peer-focus-visible:ring-blue-400/60 peer-checked:border-blue-600/50 peer-checked:ring-blue-500/75"
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className={
                    embedded
                      ? LISTING_EMBEDDED_PREVIEW_IMG
                      : "aspect-square w-full object-cover transition group-hover:opacity-90"
                  }
                />
              </span>
            </label>
          ))}
        </div>
        {subsetError ? (
          <p className="text-xs text-red-400/95" role="alert">
            {subsetError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={subsetPending}
          className={`${subsetBtnClass} ${embedded ? "w-full" : ""} disabled:opacity-70`}
        >
          {subsetLabel}
        </button>
    </form>
  );

  return (
    <div className={shellClass}>
      {embedded ? (
        <>
          <div className={introClass}>
            <p className="text-xs font-medium text-zinc-500">Listing primary image</p>
            <p className="text-[11px] leading-snug text-zinc-600">
              Choose which catalog photos appear on your storefront product page.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{formBlock}</div>
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-zinc-500">Listing primary image</p>
          {formBlock}
        </>
      )}
    </div>
  );
}
