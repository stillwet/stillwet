"use client";

import { useCallback, useState } from "react";
import { resolveAdminInboxMessage } from "@/actions/admin-inbox-reply";
import { AdminInboxReplyForm } from "@/components/admin/AdminInboxReplyForm";
import type { AdminInboxRow } from "@/components/admin/AdminInboxTab";
import { isPlatformAdminInboxNotice } from "@/lib/admin-inbox-system-notice-shared";
import { formatInboxReceived, inboxEmailBody } from "@/lib/admin-inbox-row-display";
import { extractReplyToAddress } from "@/lib/admin-inbox-reply-email";
import { adminInboxReplySubject } from "@/lib/admin-inbox-reply-shared";

export function AdminInboxUnrepliedSection(props: { rows: AdminInboxRow[] }) {
  const { rows } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) : undefined;
  const selectedTo =
    selectedRow && !isPlatformAdminInboxNotice(selectedRow.resendEmailId)
      ? extractReplyToAddress(selectedRow.fromAddress) ?? selectedRow.fromAddress
      : null;

  const handleResolve = useCallback(
    async (inboundId: string) => {
      setResolvingId(inboundId);
      setResolveError(null);
      const fd = new FormData();
      fd.set("inboundId", inboundId);
      const result = await resolveAdminInboxMessage(fd);
      setResolvingId(null);
      if (result.ok) {
        if (selectedId === inboundId) setSelectedId(null);
      } else {
        setResolveError(result.error);
      }
    },
    [selectedId],
  );

  return (
    <div>
      {resolveError ? (
        <p className="mb-3 text-xs text-red-300/90" role="alert">
          {resolveError}
        </p>
      ) : null}
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
              <th className="py-2 pr-2 font-medium">Reply / Resolve</th>
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
              const isResolving = resolvingId === r.id;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-900 align-top text-zinc-300 ${
                    isSelected ? "bg-zinc-900/40" : ""
                  }`}
                >
                  <td className="py-2 pr-2 tabular-nums leading-snug text-zinc-500">
                    <span className="block">{received.dateLine}</span>
                    {received.timeLine ? (
                      <span className="block text-[10px] text-zinc-600">{received.timeLine}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={isResolving || isNotice}
                        onClick={() => setSelectedId(isSelected ? null : r.id)}
                        aria-pressed={isSelected}
                        title={isNotice ? "System notices cannot be replied to." : undefined}
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSelected
                            ? "border-sky-800/60 bg-sky-950/50 text-sky-100"
                            : "border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
                        }`}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={() => void handleResolve(r.id)}
                        className="rounded border border-zinc-700 bg-zinc-900/50 px-2 py-0.5 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-300 disabled:opacity-60"
                      >
                        {isResolving ? "…" : "Resolve"}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-2 break-words text-zinc-400">{r.fromAddress}</td>
                  <td className="py-2 pr-2 break-words font-medium text-zinc-200">{r.subject}</td>
                  <td className="py-2 break-words whitespace-pre-wrap text-zinc-400">{body}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No messages waiting for a reply.</p>
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
