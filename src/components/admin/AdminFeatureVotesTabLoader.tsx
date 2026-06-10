import { loadAdminFeaturePollData } from "@/lib/admin-feature-poll-load";
import { AdminFeatureVotesTab } from "@/components/admin/AdminFeatureVotesTab";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { FEATURE_POLL_PATH } from "@/lib/feature-poll-path";
import { worldCountriesExcludingUs } from "@/lib/world-countries";

export async function AdminFeatureVotesTabLoader(props: {
  fpErr?: string;
  fpSaved?: string;
}) {
  const { questions, migrationRequired, followUpMigrationRequired, followUpClientStale } =
    await loadAdminFeaturePollData();
  const base = publicAppBaseUrl();
  const pollUrl = base ? `${base.replace(/\/$/, "")}${FEATURE_POLL_PATH}` : FEATURE_POLL_PATH;
  const countryOptions = worldCountriesExcludingUs();

  return (
    <AdminFeatureVotesTab
      questions={questions}
      pollUrl={pollUrl}
      countryOptions={countryOptions}
      migrationRequired={migrationRequired}
      followUpMigrationRequired={followUpMigrationRequired}
      followUpClientStale={followUpClientStale}
      fpErr={props.fpErr}
      fpSaved={props.fpSaved}
    />
  );
}
