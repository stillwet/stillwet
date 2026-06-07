"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminSaveOrderReturnClaimNotes,
  adminUpdateOrderReturnClaimStatus,
} from "@/actions/admin-order-return-claims";
import { formatDisplayedDate } from "@/lib/format-display-datetime";
import { formatBuyerOrderNumberShort } from "@/lib/buyer-order-number";
import {
  OrderReturnClaimStatus,
  type OrderReturnClaimRejectionReason,
} from "@/generated/prisma/enums";
import { ORDER_RETURN_CLAIM_REJECTION_REASON_OPTIONS } from "@/lib/order-return-claim-rejection-reasons";

export type AdminOrderReturnClaimRow = {
  id: string;
  orderNumber: number;
  orderPlacedAtIso: string;
  daysSinceOrderPlaced: number;
  email: string;
  cardLast4: string;
  nameOnOrder: string;
  issueType: string;
  catalogItemName: string;
  status: OrderReturnClaimStatus;
  rejectionReason: OrderReturnClaimRejectionReason | null;
  createdAtIso: string;
  adminNotes: string | null;
  images: { imageUrl: string; sortOrder: number }[];
};

const STATUS_LABELS: Record<OrderReturnClaimStatus, string> = {
  [OrderReturnClaimStatus.new]: "New",
  [OrderReturnClaimStatus.accepted_wip]: "Accepted (WIP)",
  [OrderReturnClaimStatus.accepted_complete]: "Accepted (Complete)",
  [OrderReturnClaimStatus.rejected]: "Rejected",
};

const ISSUE_LABELS: Record<string, string> = {
  misprint: "Misprint",
  defective: "Item defective",
};

function formatSubmittedParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  return {
    date: formatDisplayedDate(iso),
    time: d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function notesForCompare(raw: string): string {
  return raw.trim();
}

function AdminReturnClaimNotesField({
  claimId,
  initialNotes,
  muted = false,
}: {
  claimId: string;
  initialNotes: string;
  muted?: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef(notesForCompare(initialNotes));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
    lastSavedRef.current = notesForCompare(initialNotes);
    setSaveState("idle");
  }, [claimId, initialNotes]);

  const save = useCallback(
    async (value: string) => {
      if (notesForCompare(value) === lastSavedRef.current) return;
      setSaveState("saving");
      const result = await adminSaveOrderReturnClaimNotes(claimId, value);
      if (result.ok) {
        lastSavedRef.current = notesForCompare(value);
        setSaveState("saved");
        window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } else {
        setSaveState("error");
      }
    },
    [claimId],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <div className="space-y-1">
      <textarea
        value={notes}
        rows={3}
        placeholder="Internal notes…"
        className={`w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs placeholder:text-zinc-600 ${
          muted ? "text-zinc-600 placeholder:text-zinc-700" : "text-zinc-200"
        }`}
        onChange={(e) => {
          const value = e.target.value;
          setNotes(value);
          if (saveState === "saved" || saveState === "error") setSaveState("idle");
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => void save(value), 600);
        }}
        onBlur={() => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          void save(notes);
        }}
      />
      {saveState === "saving" ? (
        <p className="text-[10px] text-zinc-600">Saving…</p>
      ) : saveState === "saved" ? (
        <p className="text-[10px] text-emerald-400/80">Saved</p>
      ) : saveState === "error" ? (
        <p className="text-[10px] text-red-300/90">Could not save</p>
      ) : null}
    </div>
  );
}

function AdminReturnClaimStatusField({
  claimId,
  initialStatus,
  initialRejectionReason,
  muted = false,
}: {
  claimId: string;
  initialStatus: OrderReturnClaimStatus;
  initialRejectionReason: OrderReturnClaimRejectionReason | null;
  muted?: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [rejectionReason, setRejectionReason] = useState(initialRejectionReason);
  const [pendingRejection, setPendingRejection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
    setRejectionReason(initialRejectionReason);
    setPendingRejection(false);
    setError(null);
  }, [claimId, initialStatus, initialRejectionReason]);

  const submit = useCallback(
    async (nextStatus: OrderReturnClaimStatus, reason: OrderReturnClaimRejectionReason | null) => {
      setSubmitting(true);
      setError(null);
      const fd = new FormData();
      fd.set("claimId", claimId);
      fd.set("status", nextStatus);
      if (reason) fd.set("rejectionReason", reason);
      const result = await adminUpdateOrderReturnClaimStatus(fd);
      setSubmitting(false);
      if (result.ok) {
        setStatus(nextStatus);
        setRejectionReason(reason);
        setPendingRejection(false);
      } else {
        setError(result.error);
        if (pendingRejection && nextStatus === OrderReturnClaimStatus.rejected) {
          setStatus(initialStatus);
          setPendingRejection(false);
        }
      }
    },
    [claimId, initialStatus, pendingRejection],
  );

  const handleStatusChange = (next: OrderReturnClaimStatus) => {
    if (next === OrderReturnClaimStatus.rejected) {
      if (status === OrderReturnClaimStatus.rejected && rejectionReason) {
        return;
      }
      setPendingRejection(true);
      setStatus(next);
      return;
    }
    void submit(next, null);
  };

  const handleReasonChange = (reason: OrderReturnClaimRejectionReason) => {
    setRejectionReason(reason);
    void submit(OrderReturnClaimStatus.rejected, reason);
  };

  const showRejectionRadios =
    status === OrderReturnClaimStatus.rejected || pendingRejection;

  return (
    <div className="space-y-2">
      <select
        value={pendingRejection ? OrderReturnClaimStatus.rejected : status}
        disabled={submitting}
        className={`w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs disabled:opacity-60 ${
          muted ? "text-zinc-600" : "text-zinc-200"
        }`}
        onChange={(e) => handleStatusChange(e.target.value as OrderReturnClaimStatus)}
      >
        {(Object.keys(STATUS_LABELS) as OrderReturnClaimStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {showRejectionRadios ? (
        <fieldset className="space-y-1.5 rounded border border-zinc-800/80 px-2 py-1.5">
          <legend className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Rejection reason
          </legend>
          {ORDER_RETURN_CLAIM_REJECTION_REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 text-[11px] leading-snug ${
                muted ? "text-zinc-700" : "text-zinc-400"
              }`}
            >
              <input
                type="radio"
                name={`reject-reason-${claimId}`}
                value={opt.value}
                checked={rejectionReason === opt.value}
                disabled={submitting}
                className="mt-0.5 border-zinc-600 bg-zinc-900 text-sky-600"
                onChange={() => handleReasonChange(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {submitting ? (
        <p className="text-[10px] text-zinc-600">Saving…</p>
      ) : error ? (
        <p className="text-[10px] text-red-300/90">{error}</p>
      ) : null}
    </div>
  );
}

export function AdminOrderReturnClaimsTab({
  rows,
  setupNotice = null,
}: {
  rows: AdminOrderReturnClaimRow[];
  setupNotice?: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter(
      (r) =>
        r.status === OrderReturnClaimStatus.new ||
        r.status === OrderReturnClaimStatus.accepted_wip,
    );
  }, [rows, statusFilter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Returns</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Buyer item claims from the returns page (newest first).
          </p>
        </div>
        <label className="flex select-none items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={statusFilter === "all"}
            onChange={(e) => setStatusFilter(e.target.checked ? "all" : "open")}
            className="border-zinc-600 bg-zinc-900 text-sky-600"
          />
          Show closed / rejected
        </label>
      </div>

      {setupNotice ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
          {setupNotice}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">No claims.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm text-zinc-300">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <th className="whitespace-nowrap px-3 py-2.5">Submitted</th>
                <th className="whitespace-nowrap px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5 leading-tight">
                  <span className="block">Order</span>
                  <span className="block">placed</span>
                </th>
                <th className="px-3 py-2.5">Contact</th>
                <th className="px-3 py-2.5">Issue / item</th>
                <th className="px-3 py-2.5">Photos</th>
                <th className="whitespace-nowrap px-3 py-2.5">Claim status</th>
                <th className="min-w-[14rem] px-3 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/90">
              {filtered.map((r) => {
                const submitted = formatSubmittedParts(r.createdAtIso);
                const isRejected = r.status === OrderReturnClaimStatus.rejected;
                const primaryText = isRejected ? "text-zinc-600" : "text-zinc-200";
                const secondaryText = isRejected ? "text-zinc-700" : "text-zinc-400";
                const tertiaryText = isRejected ? "text-zinc-700" : "text-zinc-500";
                const faintText = isRejected ? "text-zinc-800" : "text-zinc-600";
                const photoLink = isRejected
                  ? "text-xs text-zinc-600 hover:underline"
                  : "text-xs text-blue-400/90 hover:underline";
                return (
                <tr key={r.id} className={`align-top ${isRejected ? "text-zinc-600" : ""}`}>
                  <td className={`px-3 py-3 text-xs ${secondaryText}`}>
                    <span className={`block ${primaryText}`}>{submitted.date}</span>
                    <time
                      dateTime={r.createdAtIso}
                      className={`mt-0.5 block text-[10px] ${faintText}`}
                    >
                      {submitted.time}
                    </time>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 font-medium ${primaryText}`}>
                    {formatBuyerOrderNumberShort(r.orderNumber)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 text-xs ${secondaryText}`}>
                    <span className={`font-medium ${primaryText}`}>{r.daysSinceOrderPlaced}</span>
                    <span className={faintText}> d</span>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className={`block ${primaryText}`}>{r.nameOnOrder}</span>
                    <span className={`mt-0.5 block ${tertiaryText}`}>{r.email}</span>
                    <span className={`mt-0.5 block font-mono text-[10px] ${faintText}`}>
                      •••• {r.cardLast4}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className={primaryText}>{ISSUE_LABELS[r.issueType] ?? r.issueType}</span>
                    <span className={`mt-0.5 block ${tertiaryText}`}>{r.catalogItemName}</span>
                  </td>
                  <td className="px-3 py-3">
                    <ul className="flex flex-wrap gap-2">
                      {[...r.images]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((img, idx) => (
                          <li key={`${r.id}-${idx}`}>
                            <a
                              href={img.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={photoLink}
                            >
                              Photo {idx + 1}
                            </a>
                          </li>
                        ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3">
                    <AdminReturnClaimStatusField
                      claimId={r.id}
                      initialStatus={r.status}
                      initialRejectionReason={r.rejectionReason}
                      muted={isRejected}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <AdminReturnClaimNotesField
                      claimId={r.id}
                      initialNotes={r.adminNotes ?? ""}
                      muted={isRejected}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
