"use client";

import { useState, useTransition } from "react";
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

/** Stripe Connect stays locked until these are all true — list only what is still missing (clearer than a generic wall of text). */
function incompleteStripePrerequisitesSummary(steps: ShopSetupSteps): string {
  const missing: string[] = [];
  if (!steps.profile) missing.push("shop profile (display name)");
  if (!steps.guidelines) missing.push("shop regulations");
  if (!steps.listing) missing.push("a listing request");
  if (missing.length === 0) {
    return "Finish the remaining onboarding checklist items before starting Stripe Connect.";
  }
  if (missing.length === 1) {
    return `Complete ${missing[0]} before starting Stripe Connect.`;
  }
  if (missing.length === 2) {
    return `Complete ${missing[0]} and ${missing[1]} before starting Stripe Connect.`;
  }
  const last = missing[missing.length - 1]!;
  const rest = missing.slice(0, -1).join(", ");
  return `Complete ${rest}, and ${last} before starting Stripe Connect.`;
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

function ShopEmailVerificationCallout({ verified }: { verified: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  if (verified) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs italic text-zinc-500">
        Check your inbox. Don&apos;t see it? Check spam or resend link.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await resendShopEmailVerification();
            if (r.ok) setMsg({ tone: "ok", text: r.message });
            else setMsg({ tone: "err", text: r.error });
          });
        }}
        className={btnChecklistAction}
      >
        {pending ? "Sending…" : "Resend"}
      </button>
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
  stripeConnectUnlocked: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { shop, steps, stripeConnectUnlocked, embedded = false } = props;

  const stripeLabel = "Stripe Connect";

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Onboarding
      </h2>

      <nav
        className="mt-6 rounded-lg border border-zinc-800/80 bg-zinc-900/35 p-4"
        aria-label="Onboarding checklist"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">To do</p>
        <ol className="mt-3 list-none space-y-3 p-0">
          <li className="flex gap-3">
            <StepIcon done={steps.profile} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Shop profile</p>
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.guidelines} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Read shop regulations</p>
              {!steps.guidelines ? (
                <a
                  href="/dashboard?dash=itemGuidelines"
                  className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
                >
                  Open Shop regulations (next to Onboarding) →
                </a>
              ) : null}
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.emailVerified} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Verify email</p>
              {!steps.emailVerified ? (
                <div className="mt-2">
                  <ShopEmailVerificationCallout verified={steps.emailVerified} />
                </div>
              ) : null}
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.listing} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Request listing</p>
              {!steps.listing ? (
                <>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Submit at least one listing request from the Request listing tab.
                  </p>
                  <a
                    href="/dashboard?dash=requestListing"
                    className="mt-1.5 inline-block text-xs font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
                  >
                    Open Request listing tab →
                  </a>
                </>
              ) : null}
            </div>
          </li>
          <li className="flex gap-3">
            <StepIcon done={steps.stripe} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">Stripe Connect</p>
              {!steps.stripe ? (
                <>
                  <p className="mt-0.5 text-xs italic text-zinc-500">
                    Last step: Complete Stripe Connect so you can get paid when you sell items.
                  </p>
                  {!stripeConnectUnlocked ? (
                    <p className="mt-2 rounded-lg border border-amber-900/40 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
                      {incompleteStripePrerequisitesSummary(steps)}
                    </p>
                  ) : null}
                  {shop.stripeConnectPendingHint ? (
                    <p className="mt-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
                      {shop.stripeConnectPendingHint}
                    </p>
                  ) : null}
                  <form action={dashboardStartStripeConnect} className="mt-2">
                    <StripeConnectSubmitButton defaultLabel={stripeLabel} formDisabled={!stripeConnectUnlocked} />
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
