"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { CART_MAX_PRINTIFY_LINE_QTY } from "@/lib/cart-limits";
import { CheckoutForm } from "@/components/CheckoutForm";
import {
  updateCartLineFromForm,
  removeCartLineFromForm,
} from "@/actions/cart";
import { notifyCartHeaderChanged } from "@/lib/cart-header-sync-client";
import type { CartCheckoutState } from "@/lib/cart-checkout-state";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function CartCheckoutSavingOverlay(props: {
  busy: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${props.className ?? ""}`}>
      <div className={props.busy ? "pointer-events-none opacity-50" : undefined}>{props.children}</div>
      {props.busy ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/50"
          aria-busy="true"
          aria-live="polite"
        >
          <span
            className="size-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
            role="status"
            aria-label="Updating cart"
          />
        </div>
      ) : null}
    </div>
  );
}

function CartLineQtyField(props: {
  listingId: string;
  productId: string;
  quantity: number;
  maxQty: number;
  onSave: (formData: FormData) => void;
}) {
  const [draft, setDraft] = useState(String(props.quantity));
  const lastSavedRef = useRef(props.quantity);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(String(props.quantity));
    lastSavedRef.current = props.quantity;
  }, [props.quantity]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const commitQty = useCallback(
    (raw: string) => {
      const qty = Number.parseInt(raw, 10);
      if (!Number.isFinite(qty) || qty < 1 || qty > props.maxQty) {
        setDraft(String(lastSavedRef.current));
        return;
      }
      if (qty === lastSavedRef.current) return;

      const fd = new FormData();
      fd.set("listingId", props.listingId);
      fd.set("productId", props.productId);
      fd.set("qty", String(qty));
      props.onSave(fd);
      lastSavedRef.current = qty;
      setDraft(String(qty));
    },
    [props.listingId, props.maxQty, props.onSave, props.productId],
  );

  const scheduleSave = (raw: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitQty(raw), 400);
  };

  return (
    <label className="store-kicker text-zinc-500">
      Qty
      <input
        type="number"
        name="qty"
        min={1}
        max={props.maxQty}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          scheduleSave(e.target.value);
        }}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          commitQty(draft);
        }}
        className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-sm text-zinc-100"
      />
    </label>
  );
}

export function CartAndCheckoutClient({
  mode,
  initialState,
  open = true,
  onClose,
  fullCartHref = "/cart",
}: {
  mode: "page" | "drawer";
  initialState: CartCheckoutState;
  open?: boolean;
  onClose?: () => void;
  fullCartHref?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<CartCheckoutState>(initialState);
  const [loading, setLoading] = useState(mode === "drawer");
  const [qtySavingListingId, setQtySavingListingId] = useState<string | null>(null);
  const [removePending, startRemoveTransition] = useTransition();

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/cart-state", { credentials: "same-origin" });
      const j = (await r.json()) as CartCheckoutState & { error?: string };
      if (!j.error && Array.isArray(j.lines)) {
        setState(j as CartCheckoutState);
      }
    } catch {
      // Offline or unreachable — keep showing last known cart state.
    }
  }, []);

  useEffect(() => {
    if (mode === "drawer") return;
    setState(initialState);
  }, [initialState, mode]);

  useEffect(() => {
    if (mode !== "drawer" || !open) return;
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [mode, open, refetch]);

  const lines = state.lines;
  const subtotal = state.subtotalCents;
  const shippingCents = state.shippingCents;

  const handleQtySubmit = useCallback(
    (formData: FormData) => {
      const listingId = String(formData.get("listingId") ?? "").trim();
      if (!listingId) return;

      setQtySavingListingId(listingId);
      void (async () => {
        try {
          await updateCartLineFromForm(formData);
          notifyCartHeaderChanged();
          if (mode === "drawer") await refetch();
          router.refresh();
        } finally {
          setQtySavingListingId((current) => (current === listingId ? null : current));
        }
      })();
    },
    [mode, refetch, router],
  );

  const handleRemoveSubmit = useCallback(
    (formData: FormData) => {
      startRemoveTransition(async () => {
        await removeCartLineFromForm(formData);
        notifyCartHeaderChanged();
        if (mode === "drawer") await refetch();
        router.refresh();
      });
    },
    [mode, refetch, router],
  );

  if (mode === "drawer" && loading) {
    return <p className="px-6 py-8 text-sm text-zinc-500">Loading cart…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className={mode === "drawer" ? "px-6 py-6" : ""}>
        <p className="text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link
            href={SHOP_ALL_ROUTE}
            className="text-blue-400/90 hover:underline"
            onClick={onClose}
          >
            Browse products
          </Link>
        </p>
      </div>
    );
  }

  const qtySaving = qtySavingListingId != null;

  const inner = (
    <>
      <ul
        className={
          mode === "drawer"
            ? "divide-y divide-zinc-800/80 border-y border-zinc-800/80"
            : "divide-y divide-zinc-800/80 border-y border-zinc-800/80"
        }
      >
        {lines.map((l) => {
          const maxQty = CART_MAX_PRINTIFY_LINE_QTY;
          return (
            <li
              key={l.listingId}
              className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={l.productHref}
                  scroll={false}
                  className="font-medium text-zinc-100 hover:text-blue-300"
                  onClick={onClose}
                >
                  {l.name}
                </Link>
                {l.primaryTagName ? (
                  <p className="store-kicker mt-1 text-zinc-500">{l.primaryTagName}</p>
                ) : null}
                {l.variantSub ? (
                  <p className="text-xs text-zinc-500">{l.variantSub}</p>
                ) : null}
                <p className="mt-1 text-sm text-zinc-400">
                  {formatPrice(l.unitCents)} each
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <CartLineQtyField
                  listingId={l.listingId}
                  productId={l.productId}
                  quantity={l.quantity}
                  maxQty={maxQty}
                  onSave={handleQtySubmit}
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRemoveSubmit(new FormData(e.currentTarget));
                  }}
                  className="flex items-center"
                >
                  <input type="hidden" name="listingId" value={l.listingId} />
                  <input type="hidden" name="productId" value={l.productId} />
                  <input type="hidden" name="slug" value={l.slug} />
                  <button
                    type="submit"
                    disabled={removePending || qtySaving}
                    className="store-kicker rounded-lg border border-zinc-700 px-3 py-1.5 text-blue-400/90 hover:border-blue-800/80 hover:bg-blue-950/40 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mx-auto mt-8 w-full max-w-md">
        <CheckoutForm
          subtotalCents={subtotal}
          shippingCents={shippingCents}
          estimatedSalesTaxRate={state.estimatedSalesTaxRate}
          paymentProcessingIncludeTaxService={state.paymentProcessingIncludeTaxService}
          buyerCheckoutDisabled={state.buyerCheckoutDisabled}
        />
      </div>

      <p className="mt-6 text-center">
        <Link
          href="/returns"
          className="text-[11px] text-zinc-600 transition hover:text-zinc-500"
          onClick={onClose}
        >
          Return &amp; refund policy
        </Link>
      </p>
    </>
  );

  if (mode === "drawer") {
    return (
      <CartCheckoutSavingOverlay busy={qtySaving} className="px-6 pb-8 pt-2">
        {inner}
      </CartCheckoutSavingOverlay>
    );
  }

  return <CartCheckoutSavingOverlay busy={qtySaving}>{inner}</CartCheckoutSavingOverlay>;
}
