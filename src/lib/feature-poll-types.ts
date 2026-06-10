import type {
  FeaturePollOptionFollowUpKind,
  FeaturePollOptionStatus,
} from "@/generated/prisma/enums";

export const FEATURE_POLL_MIGRATION_ID = "20260615120000_feature_poll";

export const FEATURE_POLL_FOLLOWUP_MIGRATION_ID = "20260616120000_feature_poll_option_followup";

export const FEATURE_POLL_RADIO_FOLLOWUP_MIGRATION_ID =
  "20260617120000_feature_poll_radio_followup";

export type FeaturePollOptionRow = {
  id: string;
  label: string;
  sortOrder: number;
  status: FeaturePollOptionStatus;
  followUpKind: FeaturePollOptionFollowUpKind;
  followUpPrompt: string | null;
  followUpChoices: string[];
};

export type FeaturePollQuestionRow = {
  id: string;
  prompt: string;
  sortOrder: number;
  options: FeaturePollOptionRow[];
};

export type FeaturePollShopVoteRow = {
  questionId: string;
  optionId: string;
  optionLabel: string;
  followUpKind: FeaturePollOptionFollowUpKind;
  followUpPrompt: string | null;
  followUpAnswerDisplay: string | null;
};
