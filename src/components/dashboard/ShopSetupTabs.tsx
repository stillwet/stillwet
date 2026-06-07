"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { dashboardStartStripeConnect } from "@/actions/dashboard-marketplace";
import { resendShopEmailVerification } from "@/actions/shop-email-verify";

export type ShopSetupShopPayload = {
  shopSlug: string;
  displayName: string;
  /** When true, shop may appear on `/shops` and home “top shops”; storefront stays linkable either way. */
  listedOnShopsBrowse: boolean;
  profileImageUrl: string | null;
  welcomeMessage: string | null;
  socialLinks: unknown;
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountDeletionRequestedAt: string | null;
  accountDeletionEmailConfirmedAt: string | null;
  /** Stripe USD cents when deletion email is confirmed (for gating final delete); null otherwise. */
  stripeConnectBalance: { availableCents: number; pendingCents: number } | null;
  /** When Connect exists but charges/payouts are off — synced from Stripe requirements. */
  stripeConnectPendingHint?: string | null;
  flair?: {
    purchasedAt: string | null;
    /** Selected flair type (display name from type.label). */
    selectedType: null | { id: string; slug: string; label: string };
    catalog: {
      types: Array<{ id: string; slug: string; label: string }>;
    };
  };
};

export type ShopSetupSteps = {
  profile: boolean;
  guidelines: boolean;
  emailVerified: boolean;
  listing: boolean;
  stripe: boolean;
};

const btnChecklistAction =
  "rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:opacity-50";

function StepIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-[10px] font-bold text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-600"
      aria-hidden
    />
  );
}

function StripeConnectSubmitButton({
  defaultLabel,
  formDisabled,
}: {
  defaultLabel: string;
  formDisabled: boolean;
}) {
  const { pending } = useFormStatus();
  const disabled = pending || formDisabled;
  return (
    <button
      type="submit"
      disabled={disabled}
      className={pending ? `${btnChecklistAction} cursor-wait` : btnChecklistAction}
    >
      {pending ? "Opening Stripe…" : defaultLabel}
    </button>
  );
}

const onboardingStepLinkClass =
  "text-zinc-200 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100";

function OnboardingVerifyEmailStep({ verified }: { verified: boolean }) {
  const router = useRouter();

  return (
    <>
      <p className="text-sm font-medium text-zinc-200">
        {!verified ? (
          <button
            type="button"
            onClick={() => router.refresh()}
            className="font-inherit text-inherit hover:text-zinc-100"
          >
            Verify email
          </button>
        ) : (
          "Verify email"
        )}
      </p>
      {!verified ? (
        <div className="mt-2">
          <ShopEmailVerificationCallout verified={verified} />
        </div>
      ) : null}
    </>
  );
}

function ShopEmailVerificationCallout({ verified }: { verified: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (verified) return;
    const refreshOnboarding = () => router.refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshOnboarding();
    };
    window.addEventListener("focus", refreshOnboarding);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refreshOnboarding);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [verified, router]);

  if (verified) {
    return null;
  }

  const resendVerification = () => {
    setMsg(null);
    start(async () => {
      const r = await resendShopEmailVerification();
      if (r.ok) setMsg({ tone: "ok", text: r.message });
      else setMsg({ tone: "err", text: r.error });
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs italic text-zinc-500">
        Check your inbox. Don&apos;t see it? Check spam or{" "}
        <button
          type="button"
          disabled={pending}
          onClick={resendVerification}
          className="italic text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "sending…" : "resend link"}
        </button>
        .
      </p>
      {msg ? (
        <p
          className={
            msg.tone === "ok"
              ? "text-xs text-emerald-300/90"
              : "text-xs text-amber-300/90"
          }
          role="status"
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

export function ShopSetupTabs(props: {
  shop: ShopSetupShopPayload;
  steps: ShopSetupSteps;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { shop, steps, embedded = false } = props;

  const stripeLabel = "Continue to Stripe Connect";

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Onboarding
      </h2>
      <p className="mt-2 flex items-center gap-2 text-sm text-zinc-50">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-red-800 bg-black text-sm font-black leading-none text-white"
          aria-hidden
        >
          !
        </span>
        <span>Onboarding must be completed before your shop goes live.</span>
      </p>

      <nav
        className="mt-6 rounded-lg border border-zinc-800/80 bg-zinc-900/35 p-4"
        aria-label="Onboarding checklist"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">To do</p>
        <ol className="mt-3 list-none space-y-3 p-0">
          <li className="flex gap-3">
            <StepIcon done={steps.profile} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">
                Setup your{" "}
                {!steps.profile ? (
                  <a
                    href="/dashboard?dash=shopProfile"
                    className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
                  >
                    Shop Profile
                  </a>
                ) : (
                  "Shop Profile"
                )}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.emailVerified} />
            <div className="min-w-0 flex-1">
              <OnboardingVerifyEmailStep verified={steps.emailVerified} />
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.guidelines} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">
                Read{" "}
                {!steps.guidelines ? (
                  <a
                    href="/dashboard?dash=itemGuidelines"
                    className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
                  >
                    shop regulations
                  </a>
                ) : (
                  "shop regulations"
                )}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.listing} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">
                {!steps.listing ? (
                  <a
                    href="/dashboard?dash=requestListing"
                    className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
                  >
                    Request listing
                  </a>
                ) : (
                  "Request listing"
                )}
              </p>
              {!steps.listing ? (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Submit at least one listing request from the Request listing tab.
                </p>
              ) : null}
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.stripe} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Setup Stripe Connect</p>
              {!steps.stripe ? (
                <>
                  <p className="mt-0.5 text-xs italic text-zinc-500">
                    This is how you get paid when you sell an item.
                  </p>
                  {shop.stripeConnectPendingHint ? (
                    <p className="mt-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
                      {shop.stripeConnectPendingHint}
                    </p>
                  ) : null}
                  <form action={dashboardStartStripeConnect} className="mt-2">
                    <StripeConnectSubmitButton defaultLabel={stripeLabel} formDisabled={false} />
                  </form>
                </>
              ) : null}
            </div>
          </li>
        </ol>
      </nav>
    </section>
  );
}
