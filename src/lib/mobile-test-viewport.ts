/** CSS layout width for mobile test mode (typical phone logical width). */
export const MOBILE_TEST_VIEWPORT_WIDTH_PX = 360;

/** 360 CSS px × 2 device pixel ratio ≈ 720 physical pixels on common phones. */
export const MOBILE_TEST_DEVICE_PIXEL_RATIO = 2;

/** Preview frame height (720 physical px at 2× DPR). */
export const MOBILE_TEST_VIEWPORT_HEIGHT_PX = 720;

export const MOBILE_TEST_STORAGE_KEY = "stillwet-mobile-test-viewport";

export function readMobileTestViewportEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MOBILE_TEST_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMobileTestPreviewFrame(): boolean {
  if (typeof window === "undefined") return false;
  return window.self !== window.top;
}

function setMobileTestViewportClass(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("mobile-test-viewport", enabled);
}

export function applyMobileTestViewport(enabled: boolean): void {
  setMobileTestViewportClass(enabled);

  try {
    if (enabled) {
      window.localStorage.setItem(MOBILE_TEST_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(MOBILE_TEST_STORAGE_KEY);
    }
  } catch {
    // Private browsing or blocked storage.
  }
}

/** Apply persisted mobile test only while an admin session is active on this device. */
export function syncMobileTestViewportForAdmin(adminLoggedIn: boolean): void {
  const shouldEnable = adminLoggedIn && readMobileTestViewportEnabled();
  setMobileTestViewportClass(shouldEnable);
}

/** Reload after toggling so the preview shell mounts or unmounts. */
export function reloadAfterMobileTestToggle(enabled: boolean): void {
  applyMobileTestViewport(enabled);
  if (!enabled && isMobileTestPreviewFrame()) {
    try {
      window.top?.location.reload();
      return;
    } catch {
      // Cross-origin guard — fall through to local reload.
    }
  }
  window.location.reload();
}
