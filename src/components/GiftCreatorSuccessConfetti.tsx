"use client";

import { useMemo } from "react";

const CONFETTI_COLORS = [
  "#f472b6",
  "#38bdf8",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#fcd34d",
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
  return Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: `${((i * 37 + 11) % 94) + 3}%`,
    delay: `${((i * 0.11) % 1.4).toFixed(2)}s`,
    duration: `${2.1 + (i % 6) * 0.32}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    w: 6 + (i % 3) * 3,
    h: 4 + (i % 4) * 2,
    rotate: (i * 53) % 360,
    circle: i % 3 === 0,
  }));
}

export function GiftCreatorSuccessConfetti({
  overlay = false,
}: {
  /** When true, fills the parent (absolute inset-0) so confetti falls over centered content. */
  overlay?: boolean;
}) {
  const pieces = useMemo(() => buildConfettiPieces(), []);

  if (overlay) {
    return (
      <div
        className="gift-confetti-overlay pointer-events-none absolute inset-0 overflow-visible"
        aria-hidden
      >
        <div className="gift-confetti-burst absolute inset-0">
          {pieces.map((piece) => (
            <span
              key={piece.id}
              className="gift-confetti-piece absolute top-0 block opacity-90"
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
      </div>
    );
  }

  return (
    <div className="pointer-events-none relative -mt-2 mb-6 h-28 overflow-hidden" aria-hidden>
      <div className="gift-confetti-burst absolute inset-x-0 top-0 h-40">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="gift-confetti-piece absolute top-0 block opacity-90"
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
    </div>
  );
}
