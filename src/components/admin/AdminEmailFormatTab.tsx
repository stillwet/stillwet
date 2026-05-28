"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  adminResetSiteEmailTemplate,
  adminSaveSiteEmailTemplate,
  type AdminSaveSiteEmailTemplateResult,
} from "@/actions/admin-site-email-templates";
import {
  replaceGiftCodePlaceholders,
  replaceActionUrlInHtmlTemplate,
  wrapEmailHtmlFragmentForPreview,
} from "@/lib/email-template-placeholders";
import type { AdminSummaryEmailSettingsDTO } from "@/lib/admin-summary-email-settings-dto";
import type {
  AdminEmailFormatEntry,
  SiteEmailSendPreview,
} from "@/lib/site-email-template-service";
import type { SiteEmailTemplateKey } from "@/lib/site-email-template-keys";
import { AdminSummaryEmailPanel } from "@/components/admin/AdminSummaryEmailPanel";
import { useRouter } from "next/navigation";

/** Virtual row in the Template dropdown — opens plain-text digest preview only (no DB template). */
const ADMIN_DIGEST_TEMPLATE_CHOICE = "__admin_digest_plain_text__";

type EmailFormatTemplateChoice = SiteEmailTemplateKey | typeof ADMIN_DIGEST_TEMPLATE_CHOICE;

function isTemplateChoiceDigest(c: EmailFormatTemplateChoice): boolean {
  return c === ADMIN_DIGEST_TEMPLATE_CHOICE;
}

function previewHtmlDocument(renderedBody: string): string {
  if (/^\s*<!doctype/i.test(renderedBody)) {
    return renderedBody;
  }
  return wrapEmailHtmlFragmentForPreview(renderedBody);
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function insertAroundSelection(
  textarea: HTMLTextAreaElement | null,
  body: string,
  setBody: (s: string) => void,
  open: string,
  close: string,
  placeholder = "text",
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = body.slice(start, end);
  const inner = selected || placeholder;
  const insertion = `${open}${inner}${close}`;
  const next = body.slice(0, start) + insertion + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    textarea.focus();
    if (!selected) {
      const a = start + open.length;
      const b = a + inner.length;
      textarea.setSelectionRange(a, b);
    } else {
      const pos = start + insertion.length;
      textarea.setSelectionRange(pos, pos);
    }
  });
}

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  body: string,
  setBody: (s: string) => void,
  snippet: string,
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = body.slice(0, start) + snippet + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + snippet.length;
    textarea.setSelectionRange(cursor, cursor);
  });
}

function insertSnippetAndSelect(
  textarea: HTMLTextAreaElement | null,
  body: string,
  setBody: (s: string) => void,
  snippet: string,
  selectStartInSnippet: number,
  selectEndInSnippet: number,
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = body.slice(0, start) + snippet + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + selectStartInSnippet, start + selectEndInSnippet);
  });
}

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px"] as const;
/** CSS `font-family:` value safe inside `style="font-family:…"` (use `&quot;` for multi-word faces). */
const FONT_FAMILIES = [
  { label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", css: "Georgia, serif" },
  { label: "Tahoma", css: "Tahoma, Geneva, sans-serif" },
  { label: "Times", css: "&quot;Times New Roman&quot;, Times, serif" },
  { label: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", css: "&quot;Trebuchet MS&quot;, Helvetica, sans-serif" },
] as const;

function EmailHtmlFormatToolbar(props: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  body: string;
  setBody: (s: string) => void;
}) {
  const { textareaRef, body, setBody } = props;

  const btn =
    "rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700";

  return (
    <div
      role="toolbar"
      aria-label="HTML formatting"
      className="mt-2 flex max-w-[996px] flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2"
    >
      <span className="mr-1 text-[10px] uppercase tracking-wide text-zinc-600">Insert</span>
      <button
        type="button"
        className={btn}
        onClick={() =>
          insertAroundSelection(textareaRef.current, body, setBody, "<strong>", "</strong>")
        }
      >
        Bold
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => insertAroundSelection(textareaRef.current, body, setBody, "<em>", "</em>")}
      >
        Italic
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          insertAroundSelection(
            textareaRef.current,
            body,
            setBody,
            '<span style="text-decoration:underline">',
            "</span>",
          )
        }
      >
        Underline
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => insertAtCursor(textareaRef.current, body, setBody, "<br/>")}
      >
        Line break
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          insertAroundSelection(
            textareaRef.current,
            body,
            setBody,
            '<p style="margin:0 0 12px 0;">',
            "</p>",
            "Your paragraph",
          )
        }
      >
        Paragraph
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const snippet =
            '<ul style="margin:0 0 12px 1.1em;padding:0;">\n  <li>New item</li>\n</ul>';
          const rel = snippet.indexOf("New item");
          insertSnippetAndSelect(textareaRef.current, body, setBody, snippet, rel, rel + 8);
        }}
      >
        Bulleted list
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const snippet =
            '<ol style="margin:0 0 12px 1.1em;padding:0;">\n  <li>First item</li>\n</ol>';
          const rel = snippet.indexOf("First item");
          insertSnippetAndSelect(textareaRef.current, body, setBody, snippet, rel, rel + 10);
        }}
      >
        Numbered list
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const url = window.prompt("Link URL (https://…)", "https://");
          if (url == null || !url.trim()) return;
          const ta = textareaRef.current;
          if (!ta) return;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const selected = body.slice(start, end);
          const label = selected || window.prompt("Link text", "Click here") || "link";
          if (!label) return;
          const href = escapeHtmlAttribute(url.trim());
          const open = `<a href="${href}" style="color:#2563eb;text-decoration:underline;">`;
          const close = "</a>";
          const inner = selected || label;
          const insertion = `${open}${inner}${close}`;
          const next = body.slice(0, start) + insertion + body.slice(end);
          setBody(next);
          requestAnimationFrame(() => {
            ta.focus();
            if (!selected) {
              const i = start + open.length;
              ta.setSelectionRange(i, i + inner.length);
            } else {
              ta.setSelectionRange(start + insertion.length, start + insertion.length);
            }
          });
        }}
      >
        Link
      </button>
      <span className="mx-1 hidden h-4 w-px bg-zinc-700 sm:inline" aria-hidden />
      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="text-zinc-500">Size</span>
        <select
          aria-label="Wrap selection in font size"
          className="rounded border border-zinc-600 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-200"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            insertAroundSelection(
              textareaRef.current,
              body,
              setBody,
              `<span style="font-size:${escapeHtmlAttribute(v)}">`,
              "</span>",
            );
            e.target.value = "";
          }}
        >
          <option value="">—</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="text-zinc-500">Font</span>
        <select
          aria-label="Wrap selection in font family"
          className="max-w-[7.5rem] rounded border border-zinc-600 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-200"
          defaultValue=""
          onChange={(e) => {
            const key = e.target.value;
            if (!key) return;
            const row = FONT_FAMILIES.find((f) => f.label === key);
            e.target.value = "";
            if (!row) return;
            insertAroundSelection(
              textareaRef.current,
              body,
              setBody,
              `<span style="font-family:${row.css}">`,
              "</span>",
            );
          }}
        >
          <option value="">—</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

export function AdminEmailFormatTab(props: {
  entries: AdminEmailFormatEntry[];
  /** Saved DB template rendered through the same resolver as Resend (not the textarea). */
  sendPreviewsByKey: Record<SiteEmailTemplateKey, SiteEmailSendPreview> | null;
  summaryEmail: AdminSummaryEmailSettingsDTO;
  children?: ReactNode;
}) {
  const router = useRouter();
  const firstKey = props.entries[0]?.key;
  const [selectedChoice, setSelectedChoice] = useState<EmailFormatTemplateChoice>(
    (firstKey ?? "shop_dashboard_email_verification") as EmailFormatTemplateChoice,
  );

  const entry = useMemo(() => {
    if (props.entries.length === 0) return undefined;
    if (isTemplateChoiceDigest(selectedChoice)) return undefined;
    return props.entries.find((e) => e.key === selectedChoice) ?? props.entries[0];
  }, [props.entries, selectedChoice]);

  const [subject, setSubject] = useState(entry?.subject ?? "");
  const [body, setBody] = useState(entry?.body ?? "");

  useEffect(() => {
    if (!entry) return;
    setSubject(entry.subject);
    setBody(entry.body);
  }, [entry]);

  const [saveState, saveAction, savePending] = useActionState<
    AdminSaveSiteEmailTemplateResult | undefined,
    FormData
  >(adminSaveSiteEmailTemplate, undefined);

  const refreshedAfterLatestSave = useRef(false);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (savePending) {
      refreshedAfterLatestSave.current = false;
      return;
    }
    if (saveState?.ok && !refreshedAfterLatestSave.current) {
      refreshedAfterLatestSave.current = true;
      void router.refresh();
    }
  }, [savePending, saveState, router]);

  const editorPreviewHtml = useMemo(() => {
    if (!entry) return "";
    const html =
      entry.key === "gift_creator_redemption_codes"
        ? replaceGiftCodePlaceholders(body, {
            setupCode: "SETU-PABC-1234-DEMO",
            listingCode: "LIST-PXYZ-9876-DEMO",
            listingCredits: "10",
          })
        : replaceActionUrlInHtmlTemplate(
            body,
            entry.sampleActionUrl ?? "https://example.com/preview",
          );
    return previewHtmlDocument(html);
  }, [body, entry]);

  const savedSendPreview = entry && props.sendPreviewsByKey ? props.sendPreviewsByKey[entry.key] : null;

  if (props.entries.length === 0) {
    return (
      <section aria-label="Email format" className="space-y-10">
        <AdminSummaryEmailPanel initial={props.summaryEmail} />
        <div className="space-y-6">
          {props.children}
          <p className="text-sm text-zinc-500">No email templates configured.</p>
        </div>
      </section>
    );
  }

  if (isTemplateChoiceDigest(selectedChoice)) {
    return (
      <section aria-label="Email format" className="space-y-10">
        <AdminSummaryEmailPanel initial={props.summaryEmail} />
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Email format</h2>
            <p className="mt-1 max-w-2xl text-xs text-zinc-600">
              Choose a shop HTML template to edit, or Admin digest to preview the plain-text summary email (reporting
              window matches Send now).
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block min-w-[14rem] text-xs text-zinc-500">
              Template
              <select
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                value={selectedChoice}
                onChange={(e) => setSelectedChoice(e.target.value as EmailFormatTemplateChoice)}
              >
                {props.entries.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
                <option value={ADMIN_DIGEST_TEMPLATE_CHOICE}>Platform — admin digest (plain text preview)</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-zinc-500">
            Scheduled admin summary: plain text only. Recipients and schedule are in the panel above; this preview is
            read-only.
          </p>
          {props.children}
        </div>
      </section>
    );
  }

  if (!entry) {
    return null;
  }

  return (
    <section aria-label="Email format" className="space-y-10">
      <AdminSummaryEmailPanel initial={props.summaryEmail} />
      <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Shop email templates</h2>
        <p className="mt-1 max-w-2xl text-xs text-zinc-600">
          Edit subjects and bodies stored in the database. Action templates must keep{" "}
          <code className="font-mono text-zinc-400">{"{{ACTION_URL}}"}</code> where the signed link should go.
          Gift code templates use <code className="font-mono text-zinc-400">{"{{SETUP_CODE}}"}</code>,{" "}
          <code className="font-mono text-zinc-400">{"{{LISTING_CODE}}"}</code>, and{" "}
          <code className="font-mono text-zinc-400">{"{{LISTING_CREDITS}}"}</code>.
          The editor preview includes <strong className="font-normal text-zinc-400">unsaved</strong> changes; only
          after Save does Resend use the same HTML as &quot;Saved template (sends now)&quot;. Templates are read from
          the database this admin host uses (local vs production can differ). Use the Template menu to open the{" "}
          <span className="text-zinc-500">admin digest</span> preview.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[14rem] text-xs text-zinc-500">
          Template
          <select
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={selectedChoice}
            onChange={(e) => setSelectedChoice(e.target.value as EmailFormatTemplateChoice)}
          >
            {props.entries.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
            <option value={ADMIN_DIGEST_TEMPLATE_CHOICE}>Platform — admin digest (plain text preview)</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-zinc-500">{entry.description}</p>

      {saveState && !saveState.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/35 px-3 py-2 text-sm text-rose-100/95"
        >
          {saveState.error}
        </p>
      ) : null}
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="key" value={entry.key} />
        <label className="block text-xs text-zinc-500">
          Subject line
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          HTML body
          <p className="mt-1 max-w-[996px] text-[11px] leading-snug text-zinc-600">
            Select text (optional), then use the toolbar to wrap it in tags. With no selection, a placeholder is
            inserted and highlighted so you can type over it.
          </p>
          <EmailHtmlFormatToolbar textareaRef={bodyTextareaRef} body={body} setBody={setBody} />
          <textarea
            ref={bodyTextareaRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            spellCheck={false}
            className="mt-1 block w-full max-w-[996px] rounded border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-[13px] leading-relaxed text-zinc-100"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={savePending}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            {savePending ? "Saving…" : "Save template"}
          </button>
          <button
            type="button"
            disabled={savePending}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 disabled:opacity-50"
            onClick={() => {
              setSubject(entry.defaultSubject);
              setBody(entry.defaultBody);
            }}
          >
            Reset fields to site default (not saved)
          </button>
        </div>
      </form>

      <div className="border-t border-zinc-800 pt-4">
        <button
          type="button"
          className="text-xs text-amber-400/90 hover:underline"
          onClick={async () => {
            if (
              !window.confirm(
                "Remove the database override for this template? The app will go back to built-in defaults.",
              )
            ) {
              return;
            }
            const fd = new FormData();
            fd.set("key", entry.key);
            await adminResetSiteEmailTemplate(fd);
            router.refresh();
          }}
        >
          Clear saved override for this template
        </button>
      </div>

      <div className="space-y-6 border-t border-zinc-800 pt-6">
        {savedSendPreview ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Saved template (sends now)
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              Same resolver as Resend. Subject:{" "}
              <span className="text-zinc-400">{savedSendPreview.subject}</span>
            </p>
            <iframe
              title="Saved email template preview (send path)"
              sandbox=""
              className="mt-3 h-[min(50vh,420px)] w-full max-w-[996px] rounded-lg border border-zinc-700 bg-[#0a0a0a] shadow-lg"
              srcDoc={savedSendPreview.html}
            />
          </div>
        ) : null}
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Editor preview</h3>
          <p className="mt-1 text-[11px] text-zinc-600">
            Live textarea (may differ until you save). Fragments get a light wrapper; full HTML documents render as-is.
          </p>
          <iframe
            title="Email HTML editor preview"
            sandbox=""
            className="mt-3 h-[min(50vh,420px)] w-full max-w-[996px] rounded-lg border border-zinc-700 bg-[#0a0a0a] shadow-lg"
            srcDoc={editorPreviewHtml}
          />
        </div>
      </div>
      </div>
    </section>
  );
}
