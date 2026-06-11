"use client";

import { useActionState, useState } from "react";
import {
  submitMerchQuoteContact,
  type MerchQuoteFormState,
} from "@/actions/contact-quote";
import { FormFieldValidationBubble, FormValidationAlert } from "@/components/FormFieldValidationBubble";
import { emailFieldError, requiredFieldError } from "@/lib/form-field-validation";

const initial: MerchQuoteFormState = {
  ok: false,
  error: "",
};

export function MerchQuoteContactForm() {
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    message?: string;
  }>({});
  const [state, formAction, pending] = useActionState(
    submitMerchQuoteContact,
    initial,
  );

  if (state.ok) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
        {state.message}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        const nameError = requiredFieldError(fd.get("name"), "your name");
        const emailErr = emailFieldError(fd.get("email"));
        const message = typeof fd.get("message") === "string" ? fd.get("message") : "";
        const messageError =
          requiredFieldError(message, "a message") ??
          (typeof message === "string" && message.trim().length < 10
            ? "Message must be at least 10 characters."
            : null);
        const next = {
          name: nameError ?? undefined,
          email: emailErr ?? undefined,
          message: messageError ?? undefined,
        };
        if (next.name || next.email || next.message) {
          e.preventDefault();
          setFieldErrors(next);
          return;
        }
        setFieldErrors({});
      }}
    >
      <div>
        <label htmlFor="quote-name" className="block text-xs font-medium text-zinc-500">
          Name
        </label>
        <div className="relative mt-1">
          {fieldErrors.name ? <FormFieldValidationBubble message={fieldErrors.name} /> : null}
          <input
            id="quote-name"
            name="name"
            type="text"
            autoComplete="name"
            aria-invalid={fieldErrors.name != null}
            onChange={() => setFieldErrors((prev) => ({ ...prev, name: undefined }))}
            className={`w-full rounded-lg border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/40 ${
              fieldErrors.name ? "border-blue-500/50" : "border-zinc-700"
            }`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="quote-email" className="block text-xs font-medium text-zinc-500">
          Email
        </label>
        <div className="relative mt-1">
          {fieldErrors.email ? <FormFieldValidationBubble message={fieldErrors.email} /> : null}
          <input
            id="quote-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={fieldErrors.email != null}
            onChange={() => setFieldErrors((prev) => ({ ...prev, email: undefined }))}
            className={`w-full rounded-lg border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/40 ${
              fieldErrors.email ? "border-blue-500/50" : "border-zinc-700"
            }`}
          />
        </div>
      </div>
      <div>
        <label htmlFor="quote-message" className="block text-xs font-medium text-zinc-500">
          What do you need?
        </label>
        <div className="relative mt-1">
          {fieldErrors.message ? <FormFieldValidationBubble message={fieldErrors.message} /> : null}
          <textarea
            id="quote-message"
            name="message"
            rows={5}
            placeholder="Brand name, product types, timeline, anything we should know…"
            aria-invalid={fieldErrors.message != null}
            onChange={() => setFieldErrors((prev) => ({ ...prev, message: undefined }))}
            className={`w-full resize-y rounded-lg border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/40 ${
              fieldErrors.message ? "border-blue-500/50" : "border-zinc-700"
            }`}
          />
        </div>
      </div>

      {state.error ? <FormValidationAlert message={state.error} /> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-900 py-3 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
