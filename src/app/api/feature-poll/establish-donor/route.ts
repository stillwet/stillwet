import { NextResponse } from "next/server";
import { FEATURE_POLL_PATH } from "@/lib/feature-poll-path";
import { establishDonorVoterFromSupportSession } from "@/lib/feature-poll-voter";

export const dynamic = "force-dynamic";

/** After site support checkout, verify Stripe session and set donor vote cookie, then redirect. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  if (sessionId) {
    await establishDonorVoterFromSupportSession(sessionId);
  }
  return NextResponse.redirect(new URL(`${FEATURE_POLL_PATH}?view=donor`, url.origin));
}
