import {
  FeaturePollOptionFollowUpKind,
  FeaturePollOptionStatus,
  FeaturePollVoterKind,
} from "@/generated/prisma/enums";
import {
  FEATURE_POLL_FOLLOWUP_MIGRATION_ID,
  FEATURE_POLL_MIGRATION_ID,
} from "@/lib/feature-poll-types";
import { prisma } from "@/lib/prisma";
import { prismaClientSupportsFeaturePollFollowUp } from "@/lib/feature-poll-client-capabilities";
import {
  isFeaturePollFollowUpSchemaDriftError,
  isPrismaMissingRelationError,
} from "@/lib/prisma-missing-relation";
import { worldCountryLabelForCode } from "@/lib/world-countries";
import { parseFollowUpChoicesFromDb } from "@/lib/feature-poll-follow-up-choices";

export type AdminFeaturePollOptionRow = {
  id: string;
  label: string;
  sortOrder: number;
  status: FeaturePollOptionStatus;
  followUpKind: FeaturePollOptionFollowUpKind;
  followUpPrompt: string | null;
  followUpChoices: string[];
  voteCount: number;
  voters: AdminFeaturePollVoterRow[];
};

export type AdminFeaturePollVoterRow = {
  id: string;
  voterKind: FeaturePollVoterKind;
  label: string;
  followUpAnswer: string | null;
  followUpAnswerDisplay: string | null;
  createdAtIso: string;
};

export type AdminFeaturePollQuestionRow = {
  id: string;
  prompt: string;
  sortOrder: number;
  active: boolean;
  options: AdminFeaturePollOptionRow[];
};

async function loadAdminFeaturePollDataWithFollowUp(): Promise<AdminFeaturePollQuestionRow[]> {
  const questions = await prisma.featurePollQuestion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      options: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          votes: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              voterKind: true,
              shopDisplayName: true,
              donorEmail: true,
              followUpAnswer: true,
              createdAt: true,
            },
          },
          _count: { select: { votes: true } },
        },
      },
    },
  });

  return questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    sortOrder: q.sortOrder,
    active: q.active,
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      sortOrder: o.sortOrder,
      status: o.status,
      followUpKind: o.followUpKind,
      followUpPrompt: o.followUpPrompt,
      followUpChoices: parseFollowUpChoicesFromDb(o.followUpChoices),
      voteCount: o._count.votes,
      voters: o.votes.map((v) => {
        const rawAnswer = v.followUpAnswer?.trim() || null;
        let followUpAnswerDisplay: string | null = rawAnswer;
        if (
          rawAnswer &&
          o.followUpKind === FeaturePollOptionFollowUpKind.country_select
        ) {
          followUpAnswerDisplay = worldCountryLabelForCode(rawAnswer) ?? rawAnswer;
        }
        return {
          id: v.id,
          voterKind: v.voterKind,
          label:
            v.voterKind === FeaturePollVoterKind.shop
              ? v.shopDisplayName?.trim() || "Shop"
              : v.donorEmail?.trim() || "Donor",
          followUpAnswer: rawAnswer,
          followUpAnswerDisplay,
          createdAtIso: v.createdAt.toISOString(),
        };
      }),
    })),
  }));
}

async function loadAdminFeaturePollDataLegacy(): Promise<AdminFeaturePollQuestionRow[]> {
  const questions = await prisma.featurePollQuestion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      options: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          label: true,
          sortOrder: true,
          status: true,
          votes: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              voterKind: true,
              shopDisplayName: true,
              donorEmail: true,
              createdAt: true,
            },
          },
          _count: { select: { votes: true } },
        },
      },
    },
  });

  return questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    sortOrder: q.sortOrder,
    active: q.active,
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      sortOrder: o.sortOrder,
      status: o.status,
      followUpKind: FeaturePollOptionFollowUpKind.none,
      followUpPrompt: null,
      followUpChoices: [],
      voteCount: o._count.votes,
      voters: o.votes.map((v) => ({
        id: v.id,
        voterKind: v.voterKind,
        label:
          v.voterKind === FeaturePollVoterKind.shop
            ? v.shopDisplayName?.trim() || "Shop"
            : v.donorEmail?.trim() || "Donor",
        followUpAnswer: null,
        followUpAnswerDisplay: null,
        createdAtIso: v.createdAt.toISOString(),
      })),
    })),
  }));
}

export async function loadAdminFeaturePollData(): Promise<{
  questions: AdminFeaturePollQuestionRow[];
  migrationRequired: boolean;
  followUpMigrationRequired: boolean;
  followUpClientStale: boolean;
}> {
  if (!(await prismaClientSupportsFeaturePollFollowUp())) {
    console.warn(
      "[loadAdminFeaturePollData] Prisma client missing follow-up poll fields — run `npx prisma generate` and restart dev, or redeploy.",
    );
    const questions = await loadAdminFeaturePollDataLegacy();
    return {
      questions,
      migrationRequired: false,
      followUpMigrationRequired: false,
      followUpClientStale: true,
    };
  }

  try {
    const questions = await loadAdminFeaturePollDataWithFollowUp();
    return {
      questions,
      migrationRequired: false,
      followUpMigrationRequired: false,
      followUpClientStale: false,
    };
  } catch (e) {
    if (isFeaturePollFollowUpSchemaDriftError(e)) {
      console.error(
        `[loadAdminFeaturePollData] apply migration ${FEATURE_POLL_FOLLOWUP_MIGRATION_ID} on this database`,
        e,
      );
      try {
        const questions = await loadAdminFeaturePollDataLegacy();
        return {
          questions,
          migrationRequired: false,
          followUpMigrationRequired: true,
          followUpClientStale: false,
        };
      } catch (legacyError) {
        if (isPrismaMissingRelationError(legacyError)) {
          return {
            questions: [],
            migrationRequired: true,
            followUpMigrationRequired: false,
            followUpClientStale: false,
          };
        }
        throw legacyError;
      }
    }
    if (isPrismaMissingRelationError(e)) {
      console.error(
        `[loadAdminFeaturePollData] apply migration ${FEATURE_POLL_MIGRATION_ID} on this database`,
        e,
      );
      return {
        questions: [],
        migrationRequired: true,
        followUpMigrationRequired: false,
        followUpClientStale: false,
      };
    }
    throw e;
  }
}
