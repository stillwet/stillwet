"use client";

import { useEffect } from "react";

const SECRET_MENU_FLASH_PARAM_KEYS = [
  "smGranted",
  "smRevoked",
  "smErr",
  "smImported",
  "smImportSkipped",
] as const;

/** Drop one-shot secret-menu flash params from the URL so a hard refresh does not re-show them. */
export function AdminSecretMenuFlashParamsCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of SECRET_MENU_FLASH_PARAM_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  return null;
}
