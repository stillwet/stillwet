import { FeaturePollOptionFollowUpKind, FeaturePollOptionStatus, FeaturePollVoterKind } from "@/generated/prisma/enums";
import {
  donorCanVoteOnFeaturePollQuestion,
  normalizeFeaturePollDonorEmail,
} from "@/lib/feature-poll-vote-eligibility";
import type { FeaturePollShopVoteRow } from "@/lib/feature-poll-types";
import { FEATURE_POLL_MIGRATION_ID } from "@/lib/feature-poll-types";
import {
  loadDonorPaidTipIds,
  loadDonorUsedTipIds,
} from "@/lib/feature-poll-voter";
import { prismaClientSupportsFeaturePollFollowUp } from "@/lib/feature-poll-client-capabilities";
import {
  isFeaturePollFollowUpSchemaDriftError,
  isPrismaMissingRelationError,
} from "@/lib/prisma-missing-relation";
import { prisma } from "@/lib/prisma";
import { worldCountryLabelForCode } from "@/lib/world-countries";

export type DonorFeaturePollContext = {
  paidTipIds: string[];
  usedTipIds: string[];
  /** Latest donor vote per question (for blocked-state display). */
  latestVoteByQuestion: FeaturePollShopVoteRow[];
  canVoteByQuestionId: Record<string, boolean>;
  migrationRequired: boolean;
};

function mapDonorVoteRow(v: {
  questionId: string;
  optionId: string;
  followUpAnswer: string | null;
  option: {
    label: string;
    followUpKind: FeaturePollOptionFollowUpKind;
    followUpPrompt: string | null;
  };
}): FeaturePollShopVoteRow {
  const rawAnswer = v.followUpAnswer?.trim() || null;
  let followUpAnswerDisplay: string | null = rawAnswer;
  if (
    rawAnswer &&
    v.option.followUpKind === FeaturePollOptionFollowUpKind.country_select
  ) {
    followUpAnswerDisplay = worldCountryLabelForCode(rawAnswer) ?? rawAnswer;
  }
  return {
    questionId: v.questionId,
    optionId: v.optionId,
    optionLabel: v.option.label,
    followUpKind: v.option.followUpKind,
    followUpPrompt: v.option.followUpPrompt,
    followUpAnswerDisplay: rawAnswer ? followUpAnswerDisplay : null,
  };
}

export async function loadDonorFeaturePollContext(
  donorEmail: string,
): Promise<DonorFeaturePollContext> {
  const normalized = normalizeFeaturePollDonorEmail(donorEmail);
  const paidTipIds = await loadDonorPaidTipIds(normalized);
  const usedTipIds = await loadDonorUsedTipIds(normalized);

  const emptyContext = (): DonorFeaturePollContext => ({
    paidTipIds,
    usedTipIds,
    latestVoteByQuestion: [],
    canVoteByQuestionId: {},
    migrationRequired: false,
  });

  if (!(await prismaClientSupportsFeaturePollFollowUp())) {
    return emptyContext();
  }

  try {
    const activeQuestions = await prisma.featurePollQuestion.findMany({
      where: { active: true },
      select: { id: true },
    });

    const canVoteGlobally = donorCanVoteOnFeaturePollQuestion({
      paidTipIds,
      usedTipIds,
    });
    const canVoteByQuestionId: Record<string, boolean> = {};
    for (const q of activeQuestions) {
      canVoteByQuestionId[q.id] = canVoteGlobally;
    }

    const votes = await prisma.featurePollVote.findMany({
      where: {
        donorEmail: normalized,
        voterKind: FeaturePollVoterKind.donor,
        option: { status: FeaturePollOptionStatus.active },
      },
      select: {
        questionId: true,
        optionId: true,
        followUpAnswer: true,
        createdAt: true,
        option: {
          select: {
            label: true,
            followUpKind: true,
            followUpPrompt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const latestByQuestion = new Map<string, FeaturePollShopVoteRow>();
    for (const vote of votes) {
      if (latestByQuestion.has(vote.questionId)) continue;
      latestByQuestion.set(vote.questionId, mapDonorVoteRow(vote));
    }

    return {
      paidTipIds,
      usedTipIds,
      latestVoteByQuestion: [...latestByQuestion.values()],
      canVoteByQuestionId,
      migrationRequired: false,
    };
  } catch (e) {
    if (isPrismaMissingRelationError(e)) {
      console.error(
        `[loadDonorFeaturePollContext] apply migration ${FEATURE_POLL_MIGRATION_ID} on this database`,
        e,
      );
      return { ...emptyContext(), migrationRequired: true };
    }
    if (isFeaturePollFollowUpSchemaDriftError(e)) {
      return emptyContext();
    }
    throw e;
  }
}
