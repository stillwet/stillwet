"use client";

import { useState } from "react";
import { AdminInboxReplyForm } from "@/components/admin/AdminInboxReplyForm";
import type { AdminInboxRow } from "@/components/admin/AdminInboxTab";
import { isPlatformAdminInboxNotice } from "@/lib/admin-inbox-system-notice-shared";
import { formatInboxReceived, inboxEmailBody } from "@/lib/admin-inbox-row-display";
import { extractReplyToAddress } from "@/lib/admin-inbox-reply-email";
import { adminInboxReplySubject } from "@/lib/admin-inbox-reply-shared";

export function AdminInboxRepliedSection(props: { rows: AdminInboxRow[] }) {
  const { rows } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) : undefined;
  const selectedTo =
    selectedRow && !isPlatformAdminInboxNotice(selectedRow.resendEmailId)
      ? extractReplyToAddress(selectedRow.fromAddress) ?? selectedRow.fromAddress
      : null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[3.25rem]" />
            <col className="w-[4.5rem]" />
            <col className="w-[10.5rem]" />
            <col className="w-[11rem]" />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-2 font-medium">Received</th>
              <th className="py-2 pr-2 font-medium">Reply</th>
              <th className="py-2 pr-2 font-medium">From</th>
              <th className="py-2 pr-2 font-medium">Subject</th>
              <th className="py-2 font-medium">Email Body</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const received = formatInboxReceived(r.receivedAt);
              const body = inboxEmailBody(r.textBody, r.htmlBody);
              const isNotice = isPlatformAdminInboxNotice(r.resendEmailId);
              const isSelected = selectedId === r.id;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-900 align-top text-zinc-600 ${
                    isSelected ? "bg-zinc-900/30" : ""
                  }`}
                >
                  <td className="py-2 pr-2 tabular-nums leading-snug text-zinc-600">
                    <span className="block">{received.dateLine}</span>
                    {received.timeLine ? (
                      <span className="block text-[10px] text-zinc-700">{received.timeLine}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">
                    {isNotice ? (
                      <span className="text-zinc-700">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedId(isSelected ? null : r.id)}
                        aria-pressed={isSelected}
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                          isSelected
                            ? "border-sky-900/50 bg-sky-950/40 text-sky-200/90"
                            : "border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900/50 hover:text-zinc-400"
                        }`}
                      >
                        Reply
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-2 break-words text-zinc-600">{r.fromAddress}</td>
                  <td className="py-2 pr-2 break-words font-medium text-zinc-500">{r.subject}</td>
                  <td className="py-2 break-words whitespace-pre-wrap text-zinc-600">{body}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No replied messages yet.</p>
      ) : null}

      {selectedRow && selectedTo ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
          <AdminInboxReplyForm
            key={selectedRow.id}
            inboundId={selectedRow.id}
            toEmail={selectedTo}
            subject={adminInboxReplySubject(selectedRow.subject)}
          />
        </div>
      ) : null}
    </div>
  );
}
