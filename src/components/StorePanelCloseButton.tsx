"use client";

import Link from "next/link";
import {
  storePanelCloseButtonClass,
  storePanelCloseHeaderPositionClass,
  storePanelCloseOverlayPositionClass,
} from "@/lib/store-panel-close-button-classes";

type ClosePlacement = "overlay" | "header";

function positionClass(placement: ClosePlacement): string {
  return placement === "header"
    ? storePanelCloseHeaderPositionClass
    : storePanelCloseOverlayPositionClass;
}

export function StorePanelCloseButton({
  onClick,
  disabled,
  placement = "overlay",
  className,
  "aria-label": ariaLabel = "Close",
}: {
  onClick: () => void;
  disabled?: boolean;
  placement?: ClosePlacement;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`${storePanelCloseButtonClass} ${positionClass(placement)} ${className ?? ""}`.trim()}
    >
      ×
    </button>
  );
}

export function StorePanelCloseLink({
  href,
  placement = "overlay",
  className,
  "aria-label": ariaLabel = "Close",
}: {
  href: string;
  placement?: ClosePlacement;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`${storePanelCloseButtonClass} ${positionClass(placement)} ${className ?? ""}`.trim()}
    >
      ×
    </Link>
  );
}
