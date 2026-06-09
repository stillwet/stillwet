import { notFound, redirect } from "next/navigation";
import { dashQueryParamForTabId } from "@/lib/dashboard-dash-query";
import { getShopOwnerSessionReadonly } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Dev/demo: replay the post-onboarding confetti modal + shop profile badge. */
export default async function PreviewOnboardingCompletePage() {
  if (process.env.NODE_ENV !== "development" && process.env.DEMO_MODE !== "1") {
    notFound();
  }

  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) {
    redirect("/dashboard/login");
  }

  const dash = encodeURIComponent(dashQueryParamForTabId("shopProfile"));
  redirect(`/dashboard?onboardingComplete=1&dash=${dash}`);
}
