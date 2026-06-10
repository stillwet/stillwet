import Link from "next/link";
import { GiftCreatorSuccessShell } from "@/components/GiftCreatorSuccessShell";
import { featurePollPathWithSupportSession } from "@/lib/feature-poll-path";

const VOTE_CTA_CLASS =
  "mt-8 inline-block rounded-xl bg-blue-900/90 px-6 py-3 text-sm font-medium text-white hover:bg-blue-800";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function SupportThanksPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  const voteHref = featurePollPathWithSupportSession(sessionId?.trim() ?? "");

  return (
    <GiftCreatorSuccessShell showConfetti title="Thank you">
      <p className="text-base font-medium text-zinc-100">
        Your support means a lot. Every bit of support helps keep the site running and improving.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Now you can vote for what you want to see most.
      </p>
      <Link href={voteHref} className={VOTE_CTA_CLASS}>
        Vote for features
      </Link>
    </GiftCreatorSuccessShell>
  );
}
