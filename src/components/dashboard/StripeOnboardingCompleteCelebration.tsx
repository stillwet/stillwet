"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BRAND_CMY } from "@/lib/site-brand";

const ONBOARDING_COMPLETE_QUERY = "onboardingComplete";

const CONFETTI_COLORS = [
  BRAND_CMY.cyan,
  BRAND_CMY.magenta,
  BRAND_CMY.yellow,
  "#a78bfa",
  "#34d399",
  "#f472b6",
];

type ConfettiPiece = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  color: string;
  w: number;
  h: number;
  rotate: number;
  circle: boolean;
};

function buildConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: 56 }, (_, i) => ({
    id: i,
    left: `${((i * 41 + 7) % 96) + 2}%`,
    delay: `${((i * 0.09) % 1.8).toFixed(2)}s`,
    duration: `${2.4 + (i % 7) * 0.35}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    w: 7 + (i % 4) * 2,
    h: 5 + (i % 3) * 2,
    rotate: (i * 47) % 360,
    circle: i % 4 === 0,
  }));
}

/** Modal + confetti after full shop onboarding (Stripe return when checklist is complete). */
export function StripeOnboardingCompleteCelebration() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const strippedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const pieces = useMemo(() => buildConfettiPieces(), []);

  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (searchParams.get(ONBOARDING_COMPLETE_QUERY) !== "1") return;
    setOpen(true);
    if (strippedRef.current) return;
    strippedRef.current = true;
    const p = new URLSearchParams(searchParams.toString());
    p.delete(ONBOARDING_COMPLETE_QUERY);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss, open]);

  if (!open) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[88] overflow-hidden"
        aria-hidden
        role="presentation"
      >
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="shop-signup-confetti-piece absolute top-0 block opacity-90"
            style={{
              left: piece.left,
              width: piece.w,
              height: piece.h,
              backgroundColor: piece.color,
              borderRadius: piece.circle ? "9999px" : "1px",
              transform: `rotate(${piece.rotate}deg)`,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
            }}
          />
        ))}
      </div>

      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
        role="presentation"
        onClick={dismiss}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-complete-title"
          className="relative w-full max-w-sm rounded-xl border border-blue-500/50 bg-zinc-950 px-6 py-8 text-center shadow-xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-3xl" aria-hidden>
            🎉
          </p>
          <h2 id="onboarding-complete-title" className="mt-3 text-xl font-semibold text-zinc-50">
            Onboarding complete!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            You&apos;re ready to sell on StillWet.
          </p>
          <button
            type="button"
            autoFocus
            className="mt-6 rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            onClick={dismiss}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
