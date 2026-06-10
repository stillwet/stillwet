export const MAX_FOLLOW_UP_RADIO_CHOICES = 12;
export const MAX_FOLLOW_UP_CHOICE_LABEL_LENGTH = 200;

export function parseFollowUpChoicesText(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const choices: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const label = line.trim().slice(0, MAX_FOLLOW_UP_CHOICE_LABEL_LENGTH);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push(label);
    if (choices.length >= MAX_FOLLOW_UP_RADIO_CHOICES) break;
  }
  return choices;
}

export function serializeFollowUpChoicesText(choices: string[] | null | undefined): string {
  return parseFollowUpChoicesText((choices ?? []).join("\n")).join("\n");
}

export function parseFollowUpChoicesFromDb(value: unknown): string[] {
  if (Array.isArray(value)) {
    return parseFollowUpChoicesText(
      value.filter((entry): entry is string => typeof entry === "string").join("\n"),
    );
  }
  if (typeof value === "string") {
    return parseFollowUpChoicesText(value);
  }
  return [];
}

export function isValidFollowUpRadioAnswer(answer: string, choices: string[]): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  return choices.some((choice) => choice === trimmed);
}
