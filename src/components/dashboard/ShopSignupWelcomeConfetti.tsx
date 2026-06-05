"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BRAND_CMY } from "@/lib/site-brand";

const WELCOME_QUERY = "shopWelcome";

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

/** One-time confetti after new shop signup; strips `shopWelcome=1` from the URL. */
export function ShopSignupWelcomeConfetti() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const strippedRef = useRef(false);
  const [active, setActive] = useState(false);
  const pieces = useMemo(() => buildConfettiPieces(), []);

  useEffect(() => {
    if (searchParams.get(WELCOME_QUERY) !== "1") return;
    setActive(true);
    if (strippedRef.current) return;
    strippedRef.current = true;
    const p = new URLSearchParams(searchParams.toString());
    p.delete(WELCOME_QUERY);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setActive(false), 5200);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
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
  );
}
