export const ADMIN_INBOX_REPLY_BODY_MAX = 20_000;

/** Subject line used when replying to an inbound message. */
export function adminInboxReplySubject(original: string): string {
  const subj = original.trim() || "(no subject)";
  const replySubject = /^re:\s/i.test(subj) ? subj : `Re: ${subj}`;
  return replySubject.length > 998 ? `${replySubject.slice(0, 995)}…` : replySubject;
}

export type AdminInboxReplyState =
  | null
  | { status: "success" }
  | { status: "error"; message: string };
