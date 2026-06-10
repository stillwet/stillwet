import { FeaturePollOptionFollowUpKind } from "@/generated/prisma/enums";
import {
  isValidFollowUpRadioAnswer,
  parseFollowUpChoicesFromDb,
} from "@/lib/feature-poll-follow-up-choices";
import { isWorldCountryCodeExcludingUs } from "@/lib/world-countries";

export function validateFeaturePollFollowUpAnswer(params: {
  followUpKind: FeaturePollOptionFollowUpKind;
  followUpAnswerRaw: string | undefined;
  followUpChoices?: unknown;
}): { ok: true; answer: string | null } | { ok: false; error: string } {
  const { followUpKind, followUpAnswerRaw, followUpChoices } = params;

  if (followUpKind === FeaturePollOptionFollowUpKind.none) {
    const trimmed = followUpAnswerRaw?.trim() ?? "";
    if (trimmed) {
      return { ok: false, error: "Unexpected follow-up answer for this option." };
    }
    return { ok: true, answer: null };
  }

  const trimmed = followUpAnswerRaw?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, error: "Please answer the follow-up question." };
  }

  if (followUpKind === FeaturePollOptionFollowUpKind.free_text) {
    if (trimmed.length > 500) {
      return { ok: false, error: "Follow-up answer is too long." };
    }
    return { ok: true, answer: trimmed };
  }

  if (followUpKind === FeaturePollOptionFollowUpKind.country_select) {
    const code = trimmed.toUpperCase();
    if (!isWorldCountryCodeExcludingUs(code)) {
      return { ok: false, error: "Select a valid country." };
    }
    return { ok: true, answer: code };
  }

  if (followUpKind === FeaturePollOptionFollowUpKind.radio_select) {
    const choices = parseFollowUpChoicesFromDb(followUpChoices);
    if (choices.length < 2) {
      return { ok: false, error: "This follow-up question is not configured." };
    }
    if (!isValidFollowUpRadioAnswer(trimmed, choices)) {
      return { ok: false, error: "Select one of the available options." };
    }
    return { ok: true, answer: trimmed };
  }

  return { ok: false, error: "Invalid follow-up configuration." };
}
