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

export function GiftCreatorSuccessHeader(props: { mode: "direct" | "setup" }) {
  const pieces = useMemo(() => buildConfettiPieces(), []);

  if (props.mode === "direct") {
    return <h1 className="text-2xl font-semibold text-zinc-50">Gift sent</h1>;
  }

  return (
    <div className="relative pt-2">
      <div
        className="gift-confetti-burst pointer-events-none absolute -inset-x-6 -top-8 h-40 overflow-hidden"
        aria-hidden
      >
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
      <h1 className="relative text-2xl font-semibold text-zinc-50">Woohoo! Gift is on the way!</h1>
    </div>
  );
}
