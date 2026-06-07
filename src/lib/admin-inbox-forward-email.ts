import { adminInboxEmailAddress } from "@/lib/admin-inbox-config";
import { extractReplyToAddress } from "@/lib/admin-inbox-reply-email";
import { BRAND_NAME } from "@/lib/site-brand";

export type AdminInboxForwardInput = {
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  receivedAt: Date;
};

export type AdminInboxForwardResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false }
  | { ok: false; error: string };

export const ADMIN_INBOX_FORWARD_SUBJECT_PREFIX = "[Still Wet inbox] ";

/** Gmail / backup copy destination (`ADMIN_INBOX_FORWARD_TO_EMAIL`). */
export function adminInboxForwardToEmail(): string | null {
  const v = process.env.ADMIN_INBOX_FORWARD_TO_EMAIL?.trim().toLowerCase();
  return v || null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveForwardBody(input: AdminInboxForwardInput): string {
  const text = input.textBody?.trim();
  if (text) return text;
  const html = input.htmlBody?.trim();
  if (html) return stripHtml(html);
  return "(no text body)";
}

/** Plain-text body for the Gmail forward copy. */
export function formatAdminInboxForwardBody(input: AdminInboxForwardInput): string {
  const received = input.receivedAt.toISOString();
  const body = resolveForwardBody(input);
  return [
    "Forwarded from Still Wet admin inbox.",
    "",
    `From: ${input.fromAddress}`,
    `To: ${input.toAddress}`,
    `Subject: ${input.subject}`,
    `Received: ${received}`,
    "",
    "—",
    "",
    body,
  ].join("\n");
}

/** Subject line for the Gmail forward copy. */
export function formatAdminInboxForwardSubject(originalSubject: string): string {
  const subj = originalSubject.trim() || "(no subject)";
  const prefix = ADMIN_INBOX_FORWARD_SUBJECT_PREFIX;
  const combined = `${prefix}${subj}`;
  return combined.length > 998 ? `${combined.slice(0, 995)}…` : combined;
}

function adminInboxForwardFromHeader(): string {
  const inbox = adminInboxEmailAddress();
  return (
    process.env.ADMIN_INBOX_REPLY_FROM?.trim() ||
    `${BRAND_NAME} Inbox <${inbox}>`
  );
}

/**
 * Sends a copy of an inbound message to `ADMIN_INBOX_FORWARD_TO_EMAIL` via Resend.
 * No-op when the env var is unset.
 */
export async function forwardInboundEmailToGmail(
  input: AdminInboxForwardInput,
): Promise<AdminInboxForwardResult> {
  const forwardTo = adminInboxForwardToEmail();
  if (!forwardTo) {
    return { ok: true, skipped: true, reason: "ADMIN_INBOX_FORWARD_TO_EMAIL unset" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set." };
  }

  const replyTo = extractReplyToAddress(input.fromAddress) ?? undefined;
  const payload: Record<string, unknown> = {
    from: adminInboxForwardFromHeader(),
    to: [forwardTo],
    subject: formatAdminInboxForwardSubject(input.subject),
    text: formatAdminInboxForwardBody(input),
  };
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("[admin-inbox-forward] Resend HTTP error", {
      status: res.status,
      body: body.slice(0, 2000),
    });
    return {
      ok: false,
      error: `Resend forward failed (HTTP ${res.status}).`,
    };
  }

  return { ok: true, skipped: false };
}
