"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { StorePanelCloseButton } from "@/components/StorePanelCloseButton";

type Props = {
  open: boolean;
  clientSecret: string;
  stripePublishableKey: string;
  onClose: () => void;
};

const SCROLL_HEIGHT_BUFFER_PX = 16;

function readCheckoutZoom(mount: HTMLElement): number {
  const zoomRaw = getComputedStyle(mount).getPropertyValue("--stripe-checkout-zoom").trim();
  const zoom = Number.parseFloat(zoomRaw);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 0.78;
}

/**
 * Stripe Embedded Checkout is a cross-origin iframe — we scale with transform (not zoom,
 * which clips iframes). Spacer height tracks the transformed bounding box so scroll range
 * matches painted content (no top/bottom cutoff).
 */
function useStripeCheckoutSpacerHeight(
  open: boolean,
  clientSecret: string,
  bodyRef: RefObject<HTMLDivElement | null>,
  spacerRef: RefObject<HTMLDivElement | null>,
  mountRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const spacer = spacerRef.current;
    const mount = mountRef.current;
    if (!spacer || !mount) return;

    const sync = () => {
      const zoom = readCheckoutZoom(mount);
      const fromRect = Math.ceil(mount.getBoundingClientRect().height);
      const fromLayout = Math.ceil(mount.offsetHeight * zoom);
      const visualHeight = Math.max(fromRect, fromLayout);
      if (visualHeight <= 0) return;
      spacer.style.height = `${visualHeight + SCROLL_HEIGHT_BUFFER_PX}px`;
    };

    const ro = new ResizeObserver(sync);
    ro.observe(mount);

    const watchIframe = () => {
      const iframe = mount.querySelector("iframe");
      if (iframe) ro.observe(iframe);
    };
    watchIframe();

    const mo = new MutationObserver(watchIframe);
    mo.observe(mount, { childList: true, subtree: true });

    sync();
    const t1 = window.setTimeout(sync, 100);
    const t2 = window.setTimeout(sync, 500);
    const t3 = window.setTimeout(sync, 1500);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro.disconnect();
      mo.disconnect();
      spacer.style.height = "";
    };
  }, [open, clientSecret, spacerRef, mountRef]);

  useEffect(() => {
    if (!open) return;
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = 0;
  }, [open, clientSecret, bodyRef]);
}

export function StripeEmbeddedCheckoutOverlay({
  open,
  clientSecret,
  stripePublishableKey,
  onClose,
}: Props) {
  const stripePromise = useMemo(
    () => loadStripe(stripePublishableKey),
    [stripePublishableKey],
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useStripeCheckoutSpacerHeight(open, clientSecret, bodyRef, spacerRef, mountRef);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5000] flex items-start justify-center px-2 pb-2 pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-3 sm:pb-3 sm:pt-2"
      role="dialog"
      aria-modal="true"
      aria-label="Secure checkout"
    >
      <button
        type="button"
        aria-label="Close checkout"
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-[5001] flex h-[calc(100dvh-0.5rem-env(safe-area-inset-top,0px))] max-h-[calc(100dvh-0.5rem-env(safe-area-inset-top,0px))] w-full max-w-lg min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)]">
        <StorePanelCloseButton onClick={onClose} aria-label="Close checkout" />
        <div
          ref={bodyRef}
          className="stripe-embedded-checkout-body min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <div ref={spacerRef} className="stripe-embedded-checkout-spacer">
            <div ref={mountRef} className="stripe-embedded-checkout-mount">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
