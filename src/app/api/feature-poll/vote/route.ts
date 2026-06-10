import { NextResponse } from "next/server";
import { validateFeaturePollFollowUpAnswer } from "@/lib/feature-poll-follow-up";
import {
  createFeaturePollVoteRecord,
  loadFeaturePollVoteOption,
} from "@/lib/feature-poll-load";
import {
  buildDonorFeaturePollVoteAttribution,
  buildShopFeaturePollVoteAttribution,
  donorCanVoteOnFeaturePollQuestion,
  pickSupportTipIdForDonorVote,
  shopCanVoteOnFeaturePollQuestion,
} from "@/lib/feature-poll-vote-eligibility";
import {
  loadDonorPaidTipIds,
  loadDonorUsedTipIds,
  resolveFeaturePollVoter,
} from "@/lib/feature-poll-voter";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let body: {
    questionId?: string;
    optionId?: string;
    followUpAnswer?: string;
    voteAs?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const questionId = body.questionId?.trim() ?? "";
  const optionId = body.optionId?.trim() ?? "";
  const voteAs = body.voteAs === "donor" ? "donor" : body.voteAs === "shop" ? "shop" : null;
  if (!questionId || !optionId) {
    return NextResponse.json({ ok: false, error: "Missing question or option." }, { status: 400 });
  }
  if (!voteAs) {
    return NextResponse.json({ ok: false, error: "Missing vote context." }, { status: 400 });
  }

  const voter = await resolveFeaturePollVoter(voteAs);
  if (!voter || voter.kind !== voteAs) {
    return NextResponse.json(
      {
        ok: false,
        error:
          voteAs === "shop"
            ? "Sign in as a shop owner to vote as your shop."
            : "Complete a site support donation to vote as a supporter.",
      },
      { status: 401 },
    );
  }

  const option = await loadFeaturePollVoteOption(optionId, questionId);
  if (!option) {
    return NextResponse.json({ ok: false, error: "That option is not available." }, { status: 400 });
  }

  const followUpValidation = validateFeaturePollFollowUpAnswer({
    followUpKind: option.followUpKind,
    followUpAnswerRaw: body.followUpAnswer,
    followUpChoices: option.followUpChoices,
  });
  if (!followUpValidation.ok) {
    return NextResponse.json({ ok: false, error: followUpValidation.error }, { status: 400 });
  }

  if (voter.kind === "shop") {
    const existingVotes = await prisma.featurePollVote.findMany({
      where: { shopId: voter.shopId },
      select: {
        questionId: true,
        option: { select: { id: true, status: true } },
      },
    });
    if (
      !shopCanVoteOnFeaturePollQuestion({
        questionId,
        shopId: voter.shopId,
        existingVotes,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "You already voted on this question. You can vote again when your choice is completed.",
        },
        { status: 409 },
      );
    }

    const attribution = buildShopFeaturePollVoteAttribution({
      shopId: voter.shopId,
      shopDisplayName: voter.displayName,
    });
    await createFeaturePollVoteRecord({
      questionId,
      optionId,
      voterKind: attribution.voterKind,
      shopId: attribution.shopId,
      shopDisplayName: attribution.shopDisplayName,
      followUpAnswer: followUpValidation.answer,
    });
    return NextResponse.json({ ok: true });
  }

  const paidTipIds = await loadDonorPaidTipIds(voter.email);
  const usedTipIds = await loadDonorUsedTipIds(voter.email);
  if (
    !donorCanVoteOnFeaturePollQuestion({
      paidTipIds,
      usedTipIds,
    })
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "You already used your donation vote. Support the site again for another vote.",
      },
      { status: 409 },
    );
  }

  const supportTipId = pickSupportTipIdForDonorVote({
    paidTipIds,
    usedTipIds,
    preferredTipId: voter.supportTipId,
  });
  if (!supportTipId) {
    return NextResponse.json(
      { ok: false, error: "No donation vote credit available." },
      { status: 409 },
    );
  }

  const attribution = buildDonorFeaturePollVoteAttribution({
    donorEmail: voter.email,
    supportTipId,
  });
  await createFeaturePollVoteRecord({
    questionId,
    optionId,
    voterKind: attribution.voterKind,
    donorEmail: attribution.donorEmail,
    supportTipId: attribution.supportTipId,
    followUpAnswer: followUpValidation.answer,
  });

  return NextResponse.json({ ok: true });
}
