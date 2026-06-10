import {
  FeaturePollOptionStatus,
  FeaturePollVoterKind,
} from "@/generated/prisma/enums";

export type FeaturePollActiveShopVote = {
  questionId: string;
  optionId: string;
  optionLabel: string;
};

export type ShopVoteEligibilityInput = {
  questionId: string;
  shopId: string;
  existingVotes: ReadonlyArray<{
    questionId: string;
    option: { id: string; status: FeaturePollOptionStatus };
  }>;
};

/** Shop may vote on a question when they have no vote whose option is still active. */
export function shopCanVoteOnFeaturePollQuestion(input: ShopVoteEligibilityInput): boolean {
  const activeVote = input.existingVotes.find(
    (v) =>
      v.questionId === input.questionId &&
      v.option.status === FeaturePollOptionStatus.active,
  );
  return !activeVote;
}

export type DonorVoteEligibilityInput = {
  paidTipIds: readonly string[];
  usedTipIds: readonly string[];
};

/** Donor may vote when a paid tip has not yet been spent on any poll question. */
export function donorCanVoteOnFeaturePollQuestion(input: DonorVoteEligibilityInput): boolean {
  const used = new Set(input.usedTipIds);
  return input.paidTipIds.some((tipId) => !used.has(tipId));
}

export function pickSupportTipIdForDonorVote(input: {
  paidTipIds: readonly string[];
  usedTipIds: readonly string[];
  preferredTipId?: string | null;
}): string | null {
  const used = new Set(input.usedTipIds);
  const preferred = input.preferredTipId?.trim();
  if (preferred && !used.has(preferred) && input.paidTipIds.includes(preferred)) {
    return preferred;
  }
  return input.paidTipIds.find((tipId) => !used.has(tipId)) ?? null;
}

export type FeaturePollVoteAttribution = {
  voterKind: FeaturePollVoterKind;
  shopId?: string | null;
  shopDisplayName?: string | null;
  donorEmail?: string | null;
  supportTipId?: string | null;
};

export function buildShopFeaturePollVoteAttribution(input: {
  shopId: string;
  shopDisplayName: string;
}): FeaturePollVoteAttribution {
  return {
    voterKind: FeaturePollVoterKind.shop,
    shopId: input.shopId,
    shopDisplayName: input.shopDisplayName.trim(),
    donorEmail: null,
    supportTipId: null,
  };
}

export function buildDonorFeaturePollVoteAttribution(input: {
  donorEmail: string;
  supportTipId: string;
}): FeaturePollVoteAttribution {
  return {
    voterKind: FeaturePollVoterKind.donor,
    shopId: null,
    shopDisplayName: null,
    donorEmail: normalizeFeaturePollDonorEmail(input.donorEmail),
    supportTipId: input.supportTipId,
  };
}

export function normalizeFeaturePollDonorEmail(email: string): string {
  return email.trim().toLowerCase();
}
