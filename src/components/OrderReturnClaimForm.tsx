"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  submitOrderReturnClaim,
  verifyOrderReturnClaimDetails,
  type OrderReturnClaimCatalogOption,
  type SubmitOrderReturnClaimResult,
  type VerifyOrderReturnClaimDetailsResult,
} from "@/actions/order-return-claim";
import { ORDER_RETURN_CLAIM_MAX_PHOTOS } from "@/lib/order-return-claim-limits";
import type { OrderReturnClaimIdentityField } from "@/lib/order-return-claim-identity";
import { OrderReturnClaimIssueType } from "@/generated/prisma/enums";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";

const verifyInitial: VerifyOrderReturnClaimDetailsResult | undefined = undefined;
const submitInitial: SubmitOrderReturnClaimResult | undefined = undefined;

function fieldClassName(invalid?: boolean) {
  return `mt-1 w-full rounded-lg border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none ${
    invalid
      ? "border-red-800/80 focus:border-red-700"
      : "border-zinc-700 focus:border-zinc-500"
  }`;
}

function fieldErrorId(field: OrderReturnClaimIdentityField) {
  return `claim-${field}-error`;
}

export function OrderReturnClaimForm(props: {
  catalogOptions: OrderReturnClaimCatalogOption[];
  r2Configured: boolean;
}) {
  const { catalogOptions, r2Configured } = props;
  const identityFormRef = useRef<HTMLFormElement>(null);
  const claimFormRef = useRef<HTMLFormElement>(null);

  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyOrderReturnClaimDetails,
    verifyInitial,
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitOrderReturnClaim,
    submitInitial,
  );

  const [detailsVerified, setDetailsVerified] = useState(false);
  const [verifiedOrderNumber, setVerifiedOrderNumber] = useState<number | null>(null);
  const [verifiedIdentity, setVerifiedIdentity] = useState<{
    orderNumber: string;
    email: string;
    cardLast4: string;
    nameOnOrder: string;
  } | null>(null);
  const [photoCount, setPhotoCount] = useState(1);
  const [identityFieldError, setIdentityFieldError] = useState<
    OrderReturnClaimIdentityField | undefined
  >(undefined);

  useEffect(() => {
    if (verifyState?.ok && identityFormRef.current) {
      const fd = new FormData(identityFormRef.current);
      setDetailsVerified(true);
      setVerifiedOrderNumber(verifyState.orderNumber);
      setVerifiedIdentity({
        orderNumber: String(fd.get("orderNumber") ?? "").trim(),
        email: String(fd.get("email") ?? "").trim(),
        cardLast4: String(fd.get("cardLast4") ?? "").trim(),
        nameOnOrder: String(fd.get("nameOnOrder") ?? "").trim(),
      });
      setIdentityFieldError(undefined);
    } else if (verifyState && !verifyState.ok) {
      setDetailsVerified(false);
      setVerifiedOrderNumber(null);
      setVerifiedIdentity(null);
      setIdentityFieldError(verifyState.field);
    }
  }, [verifyState]);

  useEffect(() => {
    if (submitState && !submitState.ok && submitState.needsVerification) {
      setDetailsVerified(false);
      setVerifiedOrderNumber(null);
      setVerifiedIdentity(null);
      setIdentityFieldError(submitState.field);
    }
  }, [submitState]);

  if (submitState?.ok) {
    return (
      <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-6 text-sm text-zinc-200">
        <p className="font-medium text-emerald-100">Claim submitted</p>
        <p className="mt-2 leading-relaxed text-zinc-400">
          We received your claim and sent a confirmation email. Our team will review your photos and
          contact you if we need anything else.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
          onClick={() => window.close()}
        >
          Close window
        </button>
      </div>
    );
  }

  const verifyError = verifyState && !verifyState.ok ? verifyState : null;

  function resetVerification() {
    setDetailsVerified(false);
    setVerifiedOrderNumber(null);
    setVerifiedIdentity(null);
    setIdentityFieldError(undefined);
  }

  function onIdentityFieldChange() {
    if (detailsVerified) resetVerification();
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Step 1 — Verify order</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Confirm your order details before uploading photos and submitting a claim.
          </p>
        </div>

        {!r2Configured ? (
          <p className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
            Photo uploads are temporarily unavailable. Please try again later or email support.
          </p>
        ) : null}

        {detailsVerified && verifiedOrderNumber != null ? (
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100/90">
            Order {formatBuyerOrderNumberShort(verifiedOrderNumber)} verified. Complete step 2
            below.
            <button
              type="button"
              className="ml-2 text-xs text-emerald-200/80 underline underline-offset-2 hover:text-emerald-100"
              onClick={resetVerification}
            >
              Edit details
            </button>
          </div>
        ) : null}

        {verifyError ? (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              verifyError.outsideWindow
                ? "border-amber-900/50 bg-amber-950/20 text-amber-100"
                : "border-red-900/50 bg-red-950/20 text-red-100"
            }`}
            role="alert"
          >
            {verifyError.error}
          </p>
        ) : null}

        <form ref={identityFormRef} action={verifyAction} className="space-y-4">
          <div>
            <label htmlFor="claim-order-number" className="text-xs font-medium text-zinc-400">
              Order number <span className="text-red-400">*</span>
            </label>
            <input
              id="claim-order-number"
              name="orderNumber"
              required
              autoComplete="off"
              placeholder="#1234"
              readOnly={detailsVerified}
              onChange={onIdentityFieldChange}
              aria-invalid={identityFieldError === "orderNumber"}
              aria-describedby={
                identityFieldError === "orderNumber" ? fieldErrorId("orderNumber") : undefined
              }
              className={fieldClassName(identityFieldError === "orderNumber")}
            />
          </div>

          <div>
            <label htmlFor="claim-email" className="text-xs font-medium text-zinc-400">
              Email address on order <span className="text-red-400">*</span>
            </label>
            <input
              id="claim-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              readOnly={detailsVerified}
              onChange={onIdentityFieldChange}
              aria-invalid={identityFieldError === "email"}
              aria-describedby={identityFieldError === "email" ? fieldErrorId("email") : undefined}
              className={fieldClassName(identityFieldError === "email")}
            />
          </div>

          <div>
            <label htmlFor="claim-card-last4" className="text-xs font-medium text-zinc-400">
              Last 4 digits of card on order <span className="text-red-400">*</span>
            </label>
            <input
              id="claim-card-last4"
              name="cardLast4"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="off"
              readOnly={detailsVerified}
              onChange={onIdentityFieldChange}
              aria-invalid={identityFieldError === "cardLast4"}
              aria-describedby={
                identityFieldError === "cardLast4" ? fieldErrorId("cardLast4") : undefined
              }
              className={fieldClassName(identityFieldError === "cardLast4")}
            />
          </div>

          <div>
            <label htmlFor="claim-name" className="text-xs font-medium text-zinc-400">
              Name on order <span className="text-red-400">*</span>
            </label>
            <input
              id="claim-name"
              name="nameOnOrder"
              required
              autoComplete="name"
              readOnly={detailsVerified}
              onChange={onIdentityFieldChange}
              aria-invalid={identityFieldError === "nameOnOrder"}
              aria-describedby={
                identityFieldError === "nameOnOrder" ? fieldErrorId("nameOnOrder") : undefined
              }
              className={fieldClassName(identityFieldError === "nameOnOrder")}
            />
          </div>

          {!detailsVerified ? (
            <button
              type="submit"
              disabled={verifyPending}
              className="w-full rounded-xl border border-zinc-600 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifyPending ? "Verifying…" : "Verify order details"}
            </button>
          ) : null}
        </form>
      </section>

      <section
        className={`space-y-5 ${detailsVerified ? "" : "pointer-events-none opacity-45"}`}
        aria-disabled={!detailsVerified}
      >
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Step 2 — Submit claim</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Describe the issue, upload photos, and submit one item per claim.
          </p>
        </div>

        {submitState && !submitState.ok && !submitState.needsVerification ? (
          <p className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-100" role="alert">
            {submitState.error}
          </p>
        ) : null}

        <form ref={claimFormRef} action={submitAction} className="space-y-5">
          <input type="hidden" name="orderDetailsVerified" value={detailsVerified ? "1" : "0"} />
          {verifiedIdentity ? (
            <>
              <input type="hidden" name="orderNumber" value={verifiedIdentity.orderNumber} />
              <input type="hidden" name="email" value={verifiedIdentity.email} />
              <input type="hidden" name="cardLast4" value={verifiedIdentity.cardLast4} />
              <input type="hidden" name="nameOnOrder" value={verifiedIdentity.nameOnOrder} />
            </>
          ) : null}

          <fieldset disabled={!detailsVerified}>
            <legend className="text-xs font-medium text-zinc-400">
              Issue type <span className="text-red-400">*</span>
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="issueType"
                  value={OrderReturnClaimIssueType.misprint}
                  required={detailsVerified}
                  className="border-zinc-600 bg-zinc-900 text-sky-600"
                />
                Misprint
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="issueType"
                  value={OrderReturnClaimIssueType.defective}
                  required={detailsVerified}
                  className="border-zinc-600 bg-zinc-900 text-sky-600"
                />
                Item defective
              </label>
            </div>
          </fieldset>

          <div>
            <label htmlFor="claim-catalog-item" className="text-xs font-medium text-zinc-400">
              Item type <span className="text-red-400">*</span>
            </label>
            <select
              id="claim-catalog-item"
              name="catalogItemId"
              required={detailsVerified}
              disabled={!detailsVerified}
              defaultValue=""
              className={fieldClassName()}
            >
              <option value="" disabled>
                Select item type…
              </option>
              {catalogOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-600">One item per claim.</p>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-400">
              1 or more Photos of Item Defect <span className="text-red-400">*</span>
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              Up to {ORDER_RETURN_CLAIM_MAX_PHOTOS} photos. Clear evidence of the issue is required.
            </p>
            <div className="mt-2 space-y-2">
              {Array.from({ length: photoCount }, (_, i) => (
                <input
                  key={i}
                  type="file"
                  name={`photo${i}`}
                  accept="image/*"
                  required={detailsVerified && i === 0}
                  disabled={!detailsVerified}
                  className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200 disabled:opacity-50"
                />
              ))}
            </div>
            {photoCount < ORDER_RETURN_CLAIM_MAX_PHOTOS ? (
              <button
                type="button"
                disabled={!detailsVerified}
                className="mt-2 text-xs text-blue-400/90 hover:underline disabled:opacity-50"
                onClick={() => setPhotoCount((n) => Math.min(n + 1, ORDER_RETURN_CLAIM_MAX_PHOTOS))}
              >
                Add another photo
              </button>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="truthAcknowledged"
                value="1"
                required={detailsVerified}
                disabled={!detailsVerified}
                className="mt-0.5 border-zinc-600 bg-zinc-900 text-sky-600"
              />
              <span>I confirm the information in this claim is truthful and accurate.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                name="replacementPolicyAck"
                value="1"
                required={detailsVerified}
                disabled={!detailsVerified}
                className="mt-0.5 border-zinc-600 bg-zinc-900 text-sky-600"
              />
              <span>
                I understand that my claim needs to be approved to meet Return &amp; Refund Policy.
                Approved claims will receive a replacement item, not a refund.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!detailsVerified || submitPending || !r2Configured}
            className="w-full rounded-xl bg-blue-900/90 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitPending ? "Submitting claim…" : "Submit claim"}
          </button>
        </form>
      </section>
    </div>
  );
}
