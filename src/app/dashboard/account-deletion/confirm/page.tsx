import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy email links — confirm UI lives outside the dashboard layout. */
export default async function LegacyAccountDeletionConfirmRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tRaw = sp.t;
  const token = typeof tRaw === "string" ? tRaw : Array.isArray(tRaw) ? (tRaw[0] ?? "") : "";
  redirect(token ? `/account-deletion/confirm?t=${encodeURIComponent(token)}` : "/account-deletion/confirm");
}
