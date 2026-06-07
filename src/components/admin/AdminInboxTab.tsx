import { Fragment } from "react";
import { AdminInboxReplyForm } from "@/components/admin/AdminInboxReplyForm";
import { isPlatformAdminInboxNotice } from "@/lib/admin-inbox-system-notice";

export type AdminInboxRow = {
  id: string;
  resendEmailId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  receivedAt: string;
};

const INBOX_COLUMN_COUNT = 4;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatInboxReceived(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLine: "—", timeLine: "" };
  }
  const dateLine = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return { dateLine, timeLine: `${hours}:${minutes}${ampm}` };
}

function inboxEmailBody(textBody: string | null, htmlBody: string | null): string {
  const text = textBody?.trim();
  if (text) return text;
  const html = htmlBody?.trim();
  if (html) return stripHtml(html);
  return "—";
}

export function AdminInboxTab(props: {
  rows: AdminInboxRow[];
  inboxAddress: string;
}) {
  const { rows, inboxAddress } = props;

  return (
    <section aria-label="Admin inbox">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Inbox</h2>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[3.25rem]" />
            <col className="w-[10.5rem]" />
            <col className="w-[11rem]" />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-2 font-medium">Received</th>
              <th className="py-2 pr-2 font-medium">From</th>
              <th className="py-2 pr-2 font-medium">Subject</th>
              <th className="py-2 font-medium">Email Body</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const received = formatInboxReceived(r.receivedAt);
              const body = inboxEmailBody(r.textBody, r.htmlBody);
              return (
                <Fragment key={r.id}>
                  <tr className="border-b border-zinc-900 align-top text-zinc-300">
                    <td className="py-2 pr-2 tabular-nums leading-snug text-zinc-500">
                      <span className="block">{received.dateLine}</span>
                      {received.timeLine ? (
                        <span className="block text-[10px] text-zinc-600">{received.timeLine}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 break-words text-zinc-400">{r.fromAddress}</td>
                    <td className="py-2 pr-2 break-words font-medium text-zinc-200">{r.subject}</td>
                    <td className="py-2 break-words whitespace-pre-wrap text-zinc-400">{body}</td>
                  </tr>
                  {isPlatformAdminInboxNotice(r.resendEmailId) ? (
                    <tr className="border-b border-zinc-900 bg-zinc-950/20 align-top text-zinc-500">
                      <td colSpan={INBOX_COLUMN_COUNT} className="py-2 pr-2 pl-2 text-[11px] sm:pl-3">
                        Platform notification — no reply.
                      </td>
                    </tr>
                  ) : (
                    <tr className="border-b border-zinc-900 bg-zinc-950/30 align-top text-zinc-300">
                      <td colSpan={INBOX_COLUMN_COUNT} className="py-3 pr-2 pl-2 sm:pl-3">
                        <AdminInboxReplyForm inboundId={r.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No messages yet. Send a test to {inboxAddress} after inbound is live.</p>
      ) : null}
    </section>
  );
}
