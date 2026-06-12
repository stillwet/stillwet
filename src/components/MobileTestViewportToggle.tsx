"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MOBILE_TEST_DEVICE_PIXEL_RATIO,
  MOBILE_TEST_VIEWPORT_WIDTH_PX,
  readMobileTestViewportEnabled,
  reloadAfterMobileTestToggle,
} from "@/lib/mobile-test-viewport";

export function MobileTestViewportToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readMobileTestViewportEnabled());
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    reloadAfterMobileTestToggle(next);
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={
        enabled
          ? `Mobile test on (${MOBILE_TEST_VIEWPORT_WIDTH_PX}px preview)`
          : `Preview at ${MOBILE_TEST_VIEWPORT_WIDTH_PX}px (${MOBILE_TEST_VIEWPORT_WIDTH_PX * MOBILE_TEST_DEVICE_PIXEL_RATIO}px physical at ${MOBILE_TEST_DEVICE_PIXEL_RATIO}x)`
      }
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
        enabled
          ? "border-blue-500 bg-blue-700/80 text-white shadow-sm shadow-blue-950/40 hover:border-blue-400 hover:bg-blue-600/90"
          : "border-blue-700/70 bg-blue-950/55 text-blue-100 hover:border-blue-600 hover:bg-blue-900/65"
      }`}
    >
      Mobile Test
    </button>
  );
}
