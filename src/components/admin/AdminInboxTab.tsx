import { AdminInboxUnrepliedSection } from "@/components/admin/AdminInboxUnrepliedSection";
import { AdminInboxRepliedSection } from "@/components/admin/AdminInboxRepliedSection";

export type AdminInboxRow = {
  id: string;
  resendEmailId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  receivedAt: string;
  repliedAt: string | null;
};

export function AdminInboxTab(props: {
  rows: AdminInboxRow[];
  inboxAddress: string;
}) {
  const { rows, inboxAddress } = props;

  const needsReplyRows = rows.filter((r) => !r.repliedAt);
  const repliedRows = rows.filter((r) => Boolean(r.repliedAt));

  return (
    <section aria-label="Admin inbox">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Inbox</h2>

      <div className="mt-6 space-y-10">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Needs reply</h3>
          <div className="mt-3">
            <AdminInboxUnrepliedSection rows={needsReplyRows} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Replied / resolved
          </h3>
          <div className="mt-3">
            <AdminInboxRepliedSection rows={repliedRows} />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          No messages yet. Send a test to {inboxAddress} after inbound is live.
        </p>
      ) : null}
    </section>
  );
}
