export type CronJobReferenceRow = {
  name: string;
  path: string;
  schedule: string;
  frequency: string;
  status: "scheduled" | "manual" | "disabled";
  notes: string;
};

export const CRON_JOB_REFERENCE_ROWS: CronJobReferenceRow[] = [
  {
    name: "Daily maintenance",
    path: "/api/cron/daily-maintenance",
    schedule: "0 7 * * *",
    frequency: "Daily at 07:00 UTC",
    status: "scheduled",
    notes:
      "Rebuilds public browse snapshots and syncs beta tester onboarding status. Admin summary email is intentionally skipped for now.",
  },
  {
    name: "Beta tester onboarding sync",
    path: "/api/cron/beta-tester-onboarding",
    schedule: "Manual / legacy",
    frequency: "Once per day (via Daily maintenance)",
    status: "manual",
    notes:
      "Recomputes in-progress vs complete onboarding for shops tagged Beta Tester. Scheduled through Daily maintenance at 07:00 UTC.",
  },
  {
    name: "Monthly maintenance",
    path: "/api/cron/monthly-maintenance",
    schedule: "0 16 1 * *",
    frequency: "Monthly on the 1st at 16:00 UTC",
    status: "scheduled",
    notes: "Runs shop inactivity lifecycle and prunes old bug feedback images.",
  },
  {
    name: "Platform browse snapshots",
    path: "/api/cron/platform-hot-items-snapshot",
    schedule: "Manual / legacy",
    frequency: "Not scheduled directly",
    status: "manual",
    notes: "Kept as a manual endpoint; scheduled through Daily maintenance.",
  },
  {
    name: "Shop inactivity lifecycle",
    path: "/api/cron/shop-inactivity-lifecycle",
    schedule: "Manual / legacy",
    frequency: "Not scheduled directly",
    status: "manual",
    notes: "Kept as a manual endpoint; scheduled through Monthly maintenance.",
  },
  {
    name: "Bug feedback image prune",
    path: "/api/cron/prune-bug-feedback-images",
    schedule: "Manual / legacy",
    frequency: "Not scheduled directly",
    status: "manual",
    notes: "Kept as a manual endpoint; scheduled monthly through Monthly maintenance.",
  },
  {
    name: "Admin summary email",
    path: "/api/cron/admin-summary-email",
    schedule: "Disabled",
    frequency: "Not scheduled",
    status: "disabled",
    notes: "Disabled unless ADMIN_SUMMARY_CRON_ENABLED=1 and the endpoint is scheduled again.",
  },
];
