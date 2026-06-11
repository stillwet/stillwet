"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  searchGiftRecipientShops,
  verifyGiftRecipientShop,
  type GiftRecipientShopPick,
} from "@/actions/gift-creator-shop-search";
import { FormFieldValidationBubble } from "@/components/FormFieldValidationBubble";
import { normalizeShopSlugInput } from "@/lib/normalize-shop-slug-input";

const SEARCH_DEBOUNCE_MS = 220;

export function GiftCreatorShopPicker(props: {
  name?: string;
  onSelectedChange?: (shop: GiftRecipientShopPick | null) => void;
  fieldError?: string | null;
}) {
  const fieldName = props.name ?? "recipientShopSlug";
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState("");
  const [selectedShop, setSelectedShop] = useState<GiftRecipientShopPick | null>(null);
  const [suggestions, setSuggestions] = useState<GiftRecipientShopPick[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const normalizedInput = normalizeShopSlugInput(input);
  const showFieldError = Boolean(props.fieldError?.trim());
  const showList =
    suggestionsOpen && (suggestions.length > 0 || (input.trim() !== "" && !selectedShop));

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  const pickShop = useCallback(
    (shop: GiftRecipientShopPick) => {
      setSelectedShop(shop);
      setInput(shop.displayName);
      setSuggestionsOpen(false);
      props.onSelectedChange?.(shop);
    },
    [props.onSelectedChange],
  );

  const resolveShop = useCallback(async (raw: string): Promise<GiftRecipientShopPick | null> => {
    const slug = normalizeShopSlugInput(raw);
    if (!slug) return null;

    const local = suggestions.find((s) => s.slug === slug);
    if (local) return local;

    const r = await verifyGiftRecipientShop(raw);
    return r.ok ? r.shop : null;
  }, [suggestions]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    const trimmed = input.trim();
    if (!trimmed || selectedShop) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void searchGiftRecipientShops(trimmed).then((results) => {
        setSuggestions(results);
        setHighlightIdx(0);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [input, selectedShop]);

  function onInputChange(value: string) {
    setInput(value);
    setSelectedShop(null);
    setHighlightIdx(0);
    setSuggestionsOpen(true);
    props.onSelectedChange?.(null);
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

  return (
    <div>
      <input type="hidden" name={fieldName} value={selectedShop?.slug ?? ""} readOnly />
      <label className="block text-sm text-zinc-400">
        Shop name
        <div className="relative mt-1">
          {showFieldError ? <FormFieldValidationBubble message={props.fieldError!} /> : null}
          <input
            ref={inputRef}
            type="text"
            name={`${fieldName}Display`}
            value={input}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search by shop name"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-invalid={showFieldError || (input.trim() !== "" && !selectedShop)}
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
            className={`w-full rounded-lg border bg-zinc-900 px-3 py-2 text-zinc-100 ${
              selectedShop
                ? "border-emerald-800/60"
                : showFieldError || (input.trim() && !selectedShop)
                  ? "border-blue-500/50"
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
                    <span className="font-medium text-zinc-100">{s.displayName}</span>
                  </button>
                </li>
              ))}
              {searching ? (
                <li className="px-3 py-2 text-xs text-zinc-500">Searching…</li>
              ) : suggestions.length === 0 && normalizedInput ? (
                <li className="px-3 py-2 text-xs text-zinc-500">No matching shops.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </label>
    </div>
  );
}

export async function ensureGiftRecipientShopSelected(
  input: string,
  selectedShop: GiftRecipientShopPick | null,
): Promise<{ ok: true; shop: GiftRecipientShopPick } | { ok: false; error: string }> {
  if (selectedShop) return { ok: true, shop: selectedShop };

  const slug = normalizeShopSlugInput(input);
  if (!slug) {
    return { ok: false, error: "Select an existing shop from the suggestions." };
  }

  const r = await verifyGiftRecipientShop(input);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, shop: r.shop };
}
