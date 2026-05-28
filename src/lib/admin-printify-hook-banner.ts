export type PrintifyHookBanner = { variant: "ok" | "err"; text: string };

export function printifyHookBannerFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): PrintifyHookBanner | undefined {
  const pfyHook = typeof sp.pfyHook === "string" ? sp.pfyHook : undefined;
  const pfyHookReason = typeof sp.pfyHookReason === "string" ? sp.pfyHookReason : undefined;
  const pfyHookDetail = typeof sp.pfyHookDetail === "string" ? sp.pfyHookDetail : undefined;

  if (pfyHook === "ok") {
    return {
      variant: "ok",
      text:
        pfyHookDetail === "already"
          ? "This storefront webhook is already registered with Printify."
          : "Registered the order webhook with Printify. They can POST events to your live URL.",
    };
  }
  if (pfyHook !== "err") return undefined;

  let text = pfyHookReason ?? "Something went wrong.";
  if (pfyHookReason === "no_shop") {
    text = "Set PRINTIFY_SHOP_ID in the environment.";
  } else if (pfyHookReason === "no_secret") {
    text = "Set PRINTIFY_WEBHOOK_SECRET (at least 16 random characters) in the environment.";
  } else if (pfyHookReason === "no_public_url") {
    text = "Set NEXT_PUBLIC_APP_URL to your live https origin (or deploy on Vercel so VERCEL_URL is available).";
  } else {
    try {
      text = decodeURIComponent(pfyHookReason ?? text);
    } catch {
      /* keep raw */
    }
  }
  return { variant: "err", text };
}
