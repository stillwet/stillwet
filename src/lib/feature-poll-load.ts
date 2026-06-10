import { FeaturePollOptionFollowUpKind, FeaturePollOptionStatus, FeaturePollVoterKind } from "@/generated/prisma/enums";
import { parseFollowUpChoicesFromDb } from "@/lib/feature-poll-follow-up-choices";
import { prisma } from "@/lib/prisma";
import { prismaClientSupportsFeaturePollFollowUp } from "@/lib/feature-poll-client-capabilities";
import {
  isFeaturePollFollowUpSchemaDriftError,
  isPrismaMissingRelationError,
} from "@/lib/prisma-missing-relation";
import {
  FEATURE_POLL_FOLLOWUP_MIGRATION_ID,
  FEATURE_POLL_MIGRATION_ID,
  type FeaturePollQuestionRow,
  type FeaturePollShopVoteRow,
} from "@/lib/feature-poll-types";
import { worldCountryLabelForCode } from "@/lib/world-countries";

export {
  FEATURE_POLL_MIGRATION_ID,
  FEATURE_POLL_FOLLOWUP_MIGRATION_ID,
  type FeaturePollOptionRow,
  type FeaturePollQuestionRow,
  type FeaturePollShopVoteRow,
} from "@/lib/feature-poll-types";

async function loadActiveFeaturePollQuestionsWithFollowUp(): Promise<FeaturePollQuestionRow[]> {
  const rows = await prisma.featurePollQuestion.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      prompt: true,
      sortOrder: true,
      options: {
        where: { status: FeaturePollOptionStatus.active },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          label: true,
          sortOrder: true,
          status: true,
          followUpKind: true,
          followUpPrompt: true,
          followUpChoices: true,
        },
      },
    },
  });
  return rows
    .filter((q) => q.options.length > 0)
    .map((q) => ({
      ...q,
      options: q.options.map((o) => ({
        ...o,
        followUpChoices: parseFollowUpChoicesFromDb(o.followUpChoices),
      })),
    }));
}

async function loadActiveFeaturePollQuestionsLegacy(): Promise<FeaturePollQuestionRow[]> {
  const rows = await prisma.featurePollQuestion.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      prompt: true,
      sortOrder: true,
      options: {
        where: { status: FeaturePollOptionStatus.active },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          label: true,
          sortOrder: true,
          status: true,
        },
      },
    },
  });
  return rows
    .filter((q) => q.options.length > 0)
    .map((q) => ({
      ...q,
      options: q.options.map((o) => ({
        ...o,
        followUpKind: FeaturePollOptionFollowUpKind.none,
        followUpPrompt: null,
        followUpChoices: [],
      })),
    }));
}

export async function loadActiveFeaturePollQuestions(): Promise<{
  questions: FeaturePollQuestionRow[];
  migrationRequired: boolean;
  followUpMigrationRequired: boolean;
}> {
  if (!(await prismaClientSupportsFeaturePollFollowUp())) {
    const questions = await loadActiveFeaturePollQuestionsLegacy();
    return {
      questions,
      migrationRequired: false,
      followUpMigrationRequired: false,
    };
  }

  try {
    const questions = await loadActiveFeaturePollQuestionsWithFollowUp();
    return {
      questions,
      migrationRequired: false,
      followUpMigrationRequired: false,
    };
  } catch (e) {
    if (isFeaturePollFollowUpSchemaDriftError(e)) {
      console.error(
        `[loadActiveFeaturePollQuestions] apply migration ${FEATURE_POLL_FOLLOWUP_MIGRATION_ID} on this database`,
        e,
      );
      try {
        const questions = await loadActiveFeaturePollQuestionsLegacy();
        return {
          questions,
          migrationRequired: false,
          followUpMigrationRequired: true,
        };
      } catch (legacyError) {
        if (isPrismaMissingRelationError(legacyError)) {
          return { questions: [], migrationRequired: true, followUpMigrationRequired: false };
        }
        throw legacyError;
      }
    }
    if (isPrismaMissingRelationError(e)) {
      console.error(
        `[loadActiveFeaturePollQuestions] apply migration ${FEATURE_POLL_MIGRATION_ID} on this database`,
        e,
      );
      return { questions: [], migrationRequired: true, followUpMigrationRequired: false };
    }
    throw e;
  }
}

function mapShopVoteRow(v: {
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

async function loadShopActiveFeaturePollVotesLegacy(
  shopId: string,
): Promise<FeaturePollShopVoteRow[]> {
  const votes = await prisma.featurePollVote.findMany({
    where: {
      shopId,
      option: { status: FeaturePollOptionStatus.active },
    },
    select: {
      questionId: true,
      optionId: true,
      option: { select: { label: true } },
    },
  });
  return votes.map((v) => ({
    questionId: v.questionId,
    optionId: v.optionId,
    optionLabel: v.option.label,
    followUpKind: FeaturePollOptionFollowUpKind.none,
    followUpPrompt: null,
    followUpAnswerDisplay: null,
  }));
}

export async function loadShopActiveFeaturePollVotes(
  shopId: string,
): Promise<{ votes: FeaturePollShopVoteRow[]; migrationRequired: boolean }> {
  if (!(await prismaClientSupportsFeaturePollFollowUp())) {
    try {
      const votes = await loadShopActiveFeaturePollVotesLegacy(shopId);
      return { votes, migrationRequired: false };
    } catch (e) {
      if (isPrismaMissingRelationError(e)) {
        return { votes: [], migrationRequired: true };
      }
      throw e;
    }
  }

  try {
    const votes = await prisma.featurePollVote.findMany({
      where: {
        shopId,
        option: { status: FeaturePollOptionStatus.active },
      },
      select: {
        questionId: true,
        optionId: true,
        followUpAnswer: true,
        option: {
          select: {
            label: true,
            followUpKind: true,
            followUpPrompt: true,
          },
        },
      },
    });
    return {
      votes: votes.map(mapShopVoteRow),
      migrationRequired: false,
    };
  } catch (e) {
    if (isFeaturePollFollowUpSchemaDriftError(e)) {
      try {
        const votes = await loadShopActiveFeaturePollVotesLegacy(shopId);
        return { votes, migrationRequired: false };
      } catch (legacyError) {
        if (isPrismaMissingRelationError(legacyError)) {
          return { votes: [], migrationRequired: true };
        }
        throw legacyError;
      }
    }
    if (isPrismaMissingRelationError(e)) {
      return { votes: [], migrationRequired: true };
    }
    throw e;
  }
}

const activePollOptionWhere = (optionId: string, questionId: string) => ({
  id: optionId,
  questionId,
  status: FeaturePollOptionStatus.active,
  question: { active: true },
});

export async function loadFeaturePollVoteOption(optionId: string, questionId: string) {
  if (!(await prismaClientSupportsFeaturePollFollowUp())) {
    const option = await prisma.featurePollOption.findFirst({
      where: activePollOptionWhere(optionId, questionId),
      select: { id: true, questionId: true },
    });
    if (!option) return null;
    return { ...option, followUpKind: FeaturePollOptionFollowUpKind.none, followUpChoices: null };
  }

  try {
    const option = await prisma.featurePollOption.findFirst({
      where: activePollOptionWhere(optionId, questionId),
      select: { id: true, questionId: true, followUpKind: true, followUpChoices: true },
    });
    if (!option) return null;
    return option;
  } catch (e) {
    if (!isFeaturePollFollowUpSchemaDriftError(e)) throw e;
    const option = await prisma.featurePollOption.findFirst({
      where: activePollOptionWhere(optionId, questionId),
      select: { id: true, questionId: true },
    });
    if (!option) return null;
    return { ...option, followUpKind: FeaturePollOptionFollowUpKind.none, followUpChoices: null };
  }
}

type FeaturePollVoteCreateData = {
  questionId: string;
  optionId: string;
  voterKind: FeaturePollVoterKind;
  shopId?: string | null;
  shopDisplayName?: string | null;
  donorEmail?: string | null;
  supportTipId?: string | null;
  followUpAnswer?: string | null;
};

export async function createFeaturePollVoteRecord(data: FeaturePollVoteCreateData) {
  try {
    await prisma.featurePollVote.create({ data });
  } catch (e) {
    if (!isFeaturePollFollowUpSchemaDriftError(e) || data.followUpAnswer == null) throw e;
    const { followUpAnswer: _omit, ...legacyData } = data;
    await prisma.featurePollVote.create({ data: legacyData });
  }
}
