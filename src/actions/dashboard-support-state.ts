/** Client + `useActionState` — must not live in a `"use server"` file (Next only allows async fn exports there). */
export type DashboardSupportSendState = {
  ok: boolean;
  error: string | null;
  /** Bumped on each successful send so the client can refetch every time. */
  sentAt: number | null;
};

export const dashboardSupportSendInitialState: DashboardSupportSendState = {
  ok: false,
  error: null,
  sentAt: null,
};
