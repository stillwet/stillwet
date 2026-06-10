import { redirect } from "next/navigation";
import { GiftCreatorSuccessShell } from "@/components/GiftCreatorSuccessShell";
import { FeaturePollVoteForm } from "@/components/feature-poll/FeaturePollVoteForm";
import { loadDonorFeaturePollContext } from "@/lib/feature-poll-donor-context";
import { featurePollPathWithSupportSession, parseFeaturePollView } from "@/lib/feature-poll-path";
import {
  loadActiveFeaturePollQuestions,
  loadShopActiveFeaturePollVotes,
} from "@/lib/feature-poll-load";
import {
  isShopOwnerSessionActive,
  resolveFeaturePollVoter,
} from "@/lib/feature-poll-voter";
import { worldCountriesExcludingUs } from "@/lib/world-countries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feature votes",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ session_id?: string; view?: string }>;
};

export default async function FeatureVotesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sessionId = sp.session_id?.trim() ?? "";
  if (sessionId) {
    redirect(featurePollPathWithSupportSession(sessionId));
  }

  const view = parseFeaturePollView(sp.view);
  const voter = await resolveFeaturePollVoter(view);
  const shopLoggedIn = await isShopOwnerSessionActive();

  const { questions, migrationRequired: pollMigrationRequired } =
    await loadActiveFeaturePollQuestions();

  const { votes: shopVotes, migrationRequired: shopVotesMigrationRequired } =
    voter?.kind === "shop"
      ? await loadShopActiveFeaturePollVotes(voter.shopId)
      : { votes: [], migrationRequired: false };

  const donorContext =
    voter?.kind === "donor"
      ? await loadDonorFeaturePollContext(voter.email)
      : null;

  const migrationRequired =
    pollMigrationRequired ||
    shopVotesMigrationRequired ||
    Boolean(donorContext?.migrationRequired);

  const voterState =
    voter?.kind === "shop"
      ? { kind: "shop" as const, displayName: voter.displayName }
      : voter?.kind === "donor"
        ? { kind: "donor" as const, email: voter.email }
        : { kind: "none" as const };

  const countryOptions = worldCountriesExcludingUs();

  return (
    <GiftCreatorSuccessShell title="Feature votes" showConfetti={false}>
      <FeaturePollVoteForm
        view={view === "auto" ? (voter?.kind === "donor" ? "donor" : "shop") : view}
        questions={questions}
        shopVotes={shopVotes}
        donorContext={donorContext}
        voter={voterState}
        shopLoggedIn={shopLoggedIn}
        countryOptions={countryOptions}
        migrationRequired={migrationRequired}
      />
    </GiftCreatorSuccessShell>
  );
}
