import Link from "next/link";
import { notFound } from "next/navigation";
import { emailLinkOrigin } from "@/lib/public-app-url";
import { shopEmailVerificationPreviewDemoToken } from "@/lib/shop-email-verification";
import { resolveShopEmailVerificationEmail } from "@/lib/site-email-template-service";
import { resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";

export const dynamic = "force-dynamic";

/**
 * Browser preview of the verify-email HTML (does not send mail).
 * Uses the same `resolveShopEmailVerificationEmail` path as Resend.
 */
export default async function PreviewVerifyEmailPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ALLOW_EMAIL_PREVIEW !== "1") {
    notFound();
  }

  const demoUrl = `${emailLinkOrigin()}/dashboard/verify-email?t=${encodeURIComponent(shopEmailVerificationPreviewDemoToken())}`;
  const { subject, html } = await resolveShopEmailVerificationEmail(demoUrl);
  const fromResult = resolveShopTransactionalEmailFrom([
    process.env.SHOP_EMAIL_VERIFICATION_EMAIL_FROM,
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
  ]);
  const from = fromResult.ok ? fromResult.from : "(from not configured)";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-lg font-semibold text-zinc-100">Verify email preview</h1>
      <p className="mt-2 text-sm text-zinc-500">
        This page does not send email — it shows the exact HTML loaded from{" "}
        <code className="rounded bg-zinc-900 px-1 text-xs">SiteEmailTemplate</code> (same as Resend).
        The admin Email format iframe shows your <strong className="text-zinc-400">unsaved</strong> editor text until
        you click Save.
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="font-medium text-zinc-500">Subject</dt>
          <dd className="mt-0.5 text-zinc-200">{subject}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">From (current env)</dt>
          <dd className="mt-0.5 break-all text-zinc-200">{from}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Demo verify URL</dt>
          <dd className="mt-0.5 break-all font-mono text-xs text-zinc-400">{demoUrl}</dd>
        </div>
      </dl>

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-700 bg-[#0a0a0a] shadow-xl">
        <p className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Email body (as sent in HTML)
        </p>
        <div
          className="px-5 py-6 text-[15px] leading-relaxed text-zinc-100 [&_a]:text-zinc-100"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link href="/dashboard" className="text-blue-400 hover:underline">
          ← Shop dashboard
        </Link>
      </p>
    </main>
  );
}
