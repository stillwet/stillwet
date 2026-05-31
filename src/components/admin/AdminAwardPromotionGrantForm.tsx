"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  adminAwardPromotionGrantForm,
  verifyAdminShopSlugForAwardGrant,
  type AdminShopSlugPick,
} from "@/actions/admin-award-promotions";
import { adminAwardCatalog } from "@/lib/admin-award-promotions-catalog";
import { normalizeShopSlugInput } from "@/lib/normalize-shop-slug-input";

const SUGGESTION_LIMIT = 12;
const AWARD_OPTIONS = adminAwardCatalog();

function filterShopPickerOptions(
  options: AdminShopSlugPick[],
  rawInput: string,
): AdminShopSlugPick[] {
  const q = normalizeShopSlugInput(rawInput).toLowerCase();
  if (!q || options.length === 0) return [];

  const matches = options.filter(
    (s) =>
      s.slug.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q),
  );

  const exact = matches.find((s) => s.slug.toLowerCase() === q);
  const ordered = exact
    ? [exact, ...matches.filter((s) => s.slug !== exact.slug)]
    : matches;

  return ordered.slice(0, SUGGESTION_LIMIT);
}

export function AdminAwardPromotionGrantForm(props: {
  shopPickerOptions?: AdminShopSlugPick[];
}) {
  const shopPickerOptions = props.shopPickerOptions ?? [];
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState("");
  const [selectedShop, setSelectedShop] = useState<AdminShopSlugPick | null>(null);
  const [awardKey, setAwardKey] = useState(AWARD_OPTIONS[0]?.catalogKey ?? "");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isGranting, setIsGranting] = useState(false);

  const selectedAward = AWARD_OPTIONS.find((a) => a.catalogKey === awardKey) ?? AWARD_OPTIONS[0];
  const supportsQuantity = selectedAward?.supportsQuantity ?? true;

  const normalizedInput = normalizeShopSlugInput(input);

  const suggestions = useMemo(
    () => filterShopPickerOptions(shopPickerOptions, input),
    [shopPickerOptions, input],
  );

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  const pickShop = useCallback((shop: AdminShopSlugPick) => {
    setSelectedShop(shop);
    setInput(shop.slug);
    setSuggestionsOpen(false);
    setClientError(null);
  }, []);

  const resolveShop = useCallback(
    async (raw: string): Promise<AdminShopSlugPick | null> => {
      const slug = normalizeShopSlugInput(raw);
      if (!slug) return null;

      const local = shopPickerOptions.find((s) => s.slug === slug);
      if (local) return local;

      const r = await verifyAdminShopSlugForAwardGrant(raw);
      return r.ok ? r.shop : null;
    },
    [shopPickerOptions],
  );

  const showList =
    suggestionsOpen && (suggestions.length > 0 || (input.trim() !== "" && !selectedShop));

  function onInputChange(value: string) {
    setInput(value);
    setSelectedShop(null);
    setClientError(null);
    setHighlightIdx(0);
    setSuggestionsOpen(true);
  }

  function onInputBlur() {
    blurCloseTimer.current = setTimeout(() => setSuggestionsOpen(false), 180);
    const raw = input.trim();
    if (!raw) {
      setSelectedShop(null);
      return;
    }
    if (selectedShop && normalizeShopSlugInput(raw) === selectedShop.slug) return;

    const exact = suggestions.find((s) => s.slug === normalizedInput);
    if (exact) {
      pickShop(exact);
      return;
    }

    void resolveShop(raw).then((shop) => {
      if (shop) pickShop(shop);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setClientError(null);

    void (async () => {
      let shop = selectedShop;
      if (!shop) {
        shop = await resolveShop(input);
        if (!shop) {
          setClientError("Select an existing shop from the suggestions, or enter a valid /s/slug.");
          inputRef.current?.focus();
          return;
        }
        pickShop(shop);
      }

      const fd = new FormData(form);
      fd.set("shopSlug", shop.slug);
      fd.set("awardKey", awardKey);

      setIsGranting(true);
      try {
        await adminAwardPromotionGrantForm(fd);
      } catch (err) {
        console.error("[AdminAwardPromotionGrantForm] grant failed", err);
        setClientError("Grant failed. Check the server log and try again.");
        setIsGranting(false);
      }
    })();
  }

  const fieldControlClass =
    "h-9 w-full rounded border bg-zinc-900 px-2 text-sm text-zinc-100";

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-1.5">
      <input type="hidden" name="shopSlug" value={selectedShop?.slug ?? ""} readOnly />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5 text-[11px] leading-none text-zinc-500">
          <span>Shop slug</span>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              name="shopSlugDisplay"
              value={input}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. goddess-xtina"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showList}
              aria-controls={listId}
              aria-invalid={clientError != null || (input.trim() !== "" && !selectedShop)}
              onChange={(e) => onInputChange(e.target.value)}
              onFocus={() => {
                clearBlurTimer();
                if (input.trim()) setSuggestionsOpen(true);
              }}
              onBlur={onInputBlur}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && suggestions.length > 0) {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.min(suggestions.length - 1, i + 1));
                } else if (e.key === "ArrowUp" && suggestions.length > 0) {
                  e.preventDefault();
                  setHighlightIdx((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter" && suggestionsOpen && suggestions.length > 0) {
                  e.preventDefault();
                  pickShop(suggestions[Math.min(highlightIdx, suggestions.length - 1)]!);
                } else if (e.key === "Escape") {
                  setSuggestionsOpen(false);
                }
              }}
              className={`${fieldControlClass} font-mono ${
                selectedShop
                  ? "border-emerald-800/60"
                  : clientError || (input.trim() && !selectedShop)
                    ? "border-amber-800/70"
                    : "border-zinc-700"
              }`}
            />
            {showList ? (
              <ul
                id={listId}
                role="listbox"
                className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg"
              >
                {suggestions.map((s, i) => (
                  <li key={s.slug} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlightIdx}
                      className={
                        i === highlightIdx
                          ? "w-full bg-zinc-800 px-3 py-2 text-left text-sm"
                          : "w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/60"
                      }
                      onMouseEnter={() => setHighlightIdx(i)}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => pickShop(s)}
                    >
                      <span className="font-mono text-zinc-100">{s.slug}</span>
                      <span className="ml-2 text-xs text-zinc-500">{s.displayName}</span>
                    </button>
                  </li>
                ))}
                {suggestions.length === 0 && normalizedInput ? (
                  <li className="px-3 py-2 text-xs text-zinc-500">No matching shops.</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-0.5 text-[11px] leading-none text-zinc-500">
          <span>Award type</span>
          <select
            name="awardKey"
            value={awardKey}
            onChange={(e) => setAwardKey(e.target.value)}
            className={`${fieldControlClass} border-zinc-700`}
          >
            {AWARD_OPTIONS.map((opt) => (
              <option key={opt.catalogKey} value={opt.catalogKey}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {supportsQuantity ? (
          <label className="flex w-28 shrink-0 flex-col gap-0.5 text-[11px] leading-none text-zinc-500">
            <span>Quantity</span>
            <input
              type="number"
              name="quantity"
              required
              min={1}
              max={500}
              step={1}
              defaultValue={1}
              className={`${fieldControlClass} border-zinc-700 tabular-nums`}
            />
          </label>
        ) : (
          <input type="hidden" name="quantity" value="1" readOnly />
        )}
        <button
          type="submit"
          disabled={isGranting || !normalizedInput || !awardKey}
          className="h-9 shrink-0 rounded-lg bg-zinc-100 px-4 text-sm font-medium leading-none text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGranting ? "Granting…" : "Grant award"}
        </button>
      </div>
      {selectedAward ? (
        <p className="text-[10px] leading-relaxed text-zinc-600">{selectedAward.description}</p>
      ) : null}
      {selectedShop ? (
        <p className="text-[10px] text-emerald-500/90">
          Selected: <span className="font-medium text-emerald-200/90">{selectedShop.displayName}</span>
        </p>
      ) : (
        <p className="text-[10px] text-zinc-600">Type to search by slug or shop name · pick from the list</p>
      )}
      {clientError ? (
        <p className="text-xs text-amber-200/90" role="alert">
          {clientError}
        </p>
      ) : null}
    </form>
  );
}
