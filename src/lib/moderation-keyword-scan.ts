import type { PrismaClient } from "@/generated/prisma/client";
import {
  SHOP_SOCIAL_KEYS,
  type ShopSocialKey,
  type ShopSocialLinksRecord,
  parseShopSocialLinksJson,
} from "@/lib/shop-social-links";

type PrismaModerationDelegate = Pick<PrismaClient, "moderationKeyword">;

export function normalizeModerationPhraseKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function moderationKeywordDelegateOrNull(
  db: PrismaModerationDelegate,
): PrismaModerationDelegate["moderationKeyword"] | null {
  const delegate = db.moderationKeyword;
  return typeof delegate?.findMany === "function" ? delegate : null;
}

export async function loadModerationKeywordPhrases(
  db: PrismaModerationDelegate,
): Promise<string[]> {
  try {
    const delegate = moderationKeywordDelegateOrNull(db);
    if (!delegate) {
      console.error(
        "[loadModerationKeywordPhrases] Prisma client missing moderationKeyword delegate — run `npx prisma generate` and redeploy.",
      );
      return [];
    }
    const rows = await delegate.findMany({
      select: { phrase: true },
      orderBy: [{ phrase: "asc" }],
    });
    return rows.map((r) => r.phrase.trim()).filter(Boolean);
  } catch (e) {
    console.error(
      "[loadModerationKeywordPhrases] query failed (apply migration 20260516120000_moderation_keyword on this database?)",
      e,
    );
    return [];
  }
}

export type ModerationKeywordAdminRow = {
  id: string;
  phrase: string;
  createdAt: Date;
};

/** Admin keyword-triggers tab — never throws when the table or delegate is missing. */
export async function loadModerationKeywordAdminRows(
  db: PrismaModerationDelegate,
): Promise<{ rows: ModerationKeywordAdminRow[]; migrationRequired: boolean }> {
  try {
    const delegate = moderationKeywordDelegateOrNull(db);
    if (!delegate) {
      return { rows: [], migrationRequired: true };
    }
    const rows = await delegate.findMany({
      orderBy: [{ phrase: "asc" }],
      select: { id: true, phrase: true, createdAt: true },
    });
    return { rows, migrationRequired: false };
  } catch (e) {
    console.error(
      "[loadModerationKeywordAdminRows] query failed (apply migration 20260516120000_moderation_keyword on this database?)",
      e,
    );
    return { rows: [], migrationRequired: true };
  }
}

/**
 * Case-insensitive substring match: each phrase must appear in `haystack` with spacing preserved.
 */
export function findModerationMatches(
  haystack: string,
  phrases: readonly string[],
): string[] {
  if (!phrases.length) return [];
  const lower = haystack.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const needle = p.trim().toLowerCase();
    if (!needle) continue;
    if (!lower.includes(needle)) continue;
    if (seen.has(needle)) continue;
    seen.add(needle);
    out.push(p.trim());
  }
  return out;
}

export function buildShopProfileHaystack(parts: {
  displayName: string;
  welcomeMessage: string | null | undefined;
  socialLinks: ShopSocialLinksRecord;
}): string {
  const bits: string[] = [parts.displayName.trim()];
  const w = parts.welcomeMessage?.trim();
  if (w) bits.push(w);
  for (const k of SHOP_SOCIAL_KEYS) {
    const u = parts.socialLinks[k]?.trim();
    if (u) bits.push(u);
  }
  return bits.join("\n");
}

export function buildShopProfileHaystackFromSocialJson(
  displayName: string,
  welcomeMessage: string | null | undefined,
  socialLinksJson: unknown,
): string {
  return buildShopProfileHaystack({
    displayName,
    welcomeMessage,
    socialLinks: parseShopSocialLinksJson(socialLinksJson),
  });
}

export function buildListingTextHaystack(parts: {
  requestItemName: string | null | undefined;
  storefrontItemBlurb: string | null | undefined;
  listingSearchKeywords: string | null | undefined;
}): string {
  const bits: string[] = [];
  const n = parts.requestItemName?.trim();
  if (n) bits.push(n);
  const b = parts.storefrontItemBlurb?.trim();
  if (b) bits.push(b);
  const k = parts.listingSearchKeywords?.trim();
  if (k) bits.push(k);
  return bits.join("\n");
}

/** Visible listing title: custom request name, or catalog title when unset. */
export function effectiveListingItemDisplayName(
  requestItemName: string | null | undefined,
  catalogProductName: string,
): string {
  const custom = requestItemName?.trim();
  return custom || catalogProductName.trim();
}

/**
 * Segment included in listing moderation haystack: typed/saved name that is non-empty and differs from the catalog title.
 */
export function listingRequestItemNameForHaystack(
  displayOrTypedName: string,
  catalogProductName: string,
): string | null {
  const trimmed = displayOrTypedName.trim();
  const catalog = catalogProductName.trim();
  if (!trimmed || trimmed === catalog) return null;
  return trimmed;
}

export function moderationTriggerErrorMessage(matches: readonly string[]): string {
  if (!matches.length) return "";
  const quoted = matches.map((m) => `"${m}"`).join(", ");
  return `This text isn't allowed on the platform. Remove: ${quoted}.`;
}

function mergeUniqueModerationMatches(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set(a.map((x) => normalizeModerationPhraseKey(x)));
  const out = [...a];
  for (const x of b) {
    const k = normalizeModerationPhraseKey(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/**
 * Attribute moderation hits to listing text fields for UI: each segment is scanned separately;
 * phrases matching only the combined haystack (across `\\n` boundaries) are shown on the first
 * non-empty visible segment in item name → blurb → keywords order.
 */
export function listingModerationMatchesByFieldForUi(args: {
  phrases: readonly string[];
  requestItemNameForHaystack: string | null;
  storefrontBlurbForHaystack: string | null;
  searchKeywordsForHaystack: string | null;
  /** What the user sees / types in each area (item name box may show catalog title). */
  itemNameVisible: string;
  blurbVisible: string;
  keywordsVisible: string;
}): { itemName: string[]; storefrontBlurb: string[]; keywords: string[] } {
  const hay = buildListingTextHaystack({
    requestItemName: args.requestItemNameForHaystack,
    storefrontItemBlurb: args.storefrontBlurbForHaystack,
    listingSearchKeywords: args.searchKeywordsForHaystack,
  });
  const combinedHits = findModerationMatches(hay, args.phrases);

  const iv = args.itemNameVisible.trim();
  const bv = args.blurbVisible.trim();
  const kv = args.keywordsVisible.trim();

  let itemName = iv ? findModerationMatches(iv, args.phrases) : [];
  let storefrontBlurb = bv ? findModerationMatches(bv, args.phrases) : [];
  let keywords = kv ? findModerationMatches(kv, args.phrases) : [];

  const covered = new Set(
    [...itemName, ...storefrontBlurb, ...keywords].map((x) => normalizeModerationPhraseKey(x)),
  );
  const orphan = combinedHits.filter((h) => !covered.has(normalizeModerationPhraseKey(h)));
  if (orphan.length === 0) {
    return { itemName, storefrontBlurb, keywords };
  }
  if (iv) itemName = mergeUniqueModerationMatches(itemName, orphan);
  else if (bv) storefrontBlurb = mergeUniqueModerationMatches(storefrontBlurb, orphan);
  else if (kv) keywords = mergeUniqueModerationMatches(keywords, orphan);
  else {
    if (args.requestItemNameForHaystack?.trim()) {
      itemName = mergeUniqueModerationMatches(itemName, orphan);
    } else if (args.storefrontBlurbForHaystack?.trim()) {
      storefrontBlurb = mergeUniqueModerationMatches(storefrontBlurb, orphan);
    } else if (args.searchKeywordsForHaystack?.trim()) {
      keywords = mergeUniqueModerationMatches(keywords, orphan);
    } else {
      itemName = mergeUniqueModerationMatches(itemName, orphan);
    }
  }
  return { itemName, storefrontBlurb, keywords };
}

export type ShopProfileModerationByField = {
  displayName: string[];
  welcome: string[];
  socialByKey: Partial<Record<ShopSocialKey, string[]>>;
  socialAddDraft: string[];
};

/**
 * Per-field moderation hits for shop profile (display name, welcome, each saved social URL, add-draft URL).
 * Phrases matching only the combined profile haystack are merged into the first non-empty segment
 * in display name → welcome → social key order (then add-draft URL).
 */
export function shopProfileModerationMatchesByField(
  parts: {
    displayName: string;
    welcomeMessage: string | null | undefined;
    socialLinks: ShopSocialLinksRecord;
    /** Optional URL typed in “add link” (not yet saved into `socialLinks`). */
    socialAddDraftUrl?: string | null;
  },
  phrases: readonly string[],
): ShopProfileModerationByField {
  const draft = (parts.socialAddDraftUrl ?? "").trim();
  const hay = buildShopProfileHaystack({
    displayName: parts.displayName,
    welcomeMessage: parts.welcomeMessage,
    socialLinks: parts.socialLinks,
  });
  const combinedHay = draft ? `${hay}\n${draft}` : hay;
  const combinedHits = findModerationMatches(combinedHay, phrases);

  const d = parts.displayName.trim();
  const w = parts.welcomeMessage?.trim() ?? "";
  let displayName = d ? findModerationMatches(d, phrases) : [];
  let welcome = w ? findModerationMatches(w, phrases) : [];
  const socialByKey: Partial<Record<ShopSocialKey, string[]>> = {};
  for (const k of SHOP_SOCIAL_KEYS) {
    const u = parts.socialLinks[k]?.trim() ?? "";
    if (!u) continue;
    const h = findModerationMatches(u, phrases);
    if (h.length) socialByKey[k] = h;
  }
  let socialAddDraft = draft ? findModerationMatches(draft, phrases) : [];

  const flatSocial = SHOP_SOCIAL_KEYS.flatMap((k) => socialByKey[k] ?? []);
  const covered = new Set(
    [...displayName, ...welcome, ...flatSocial, ...socialAddDraft].map((x) =>
      normalizeModerationPhraseKey(x),
    ),
  );
  const orphan = combinedHits.filter((h) => !covered.has(normalizeModerationPhraseKey(h)));
  if (orphan.length === 0) {
    return { displayName, welcome, socialByKey, socialAddDraft };
  }
  if (d) displayName = mergeUniqueModerationMatches(displayName, orphan);
  else if (w) welcome = mergeUniqueModerationMatches(welcome, orphan);
  else {
    const keysWithUrl = SHOP_SOCIAL_KEYS.filter((k) => (parts.socialLinks[k] ?? "").trim());
    if (keysWithUrl.length) {
      const firstK = keysWithUrl[0]!;
      socialByKey[firstK] = mergeUniqueModerationMatches(socialByKey[firstK] ?? [], orphan);
    } else if (draft) socialAddDraft = mergeUniqueModerationMatches(socialAddDraft, orphan);
    else displayName = mergeUniqueModerationMatches(displayName, orphan);
  }
  return { displayName, welcome, socialByKey, socialAddDraft };
}

export function moderationMatchesForListingRequestRow(
  row: {
    requestItemName: string | null;
    storefrontItemBlurb: string | null;
    listingSearchKeywords: string | null;
    shop: {
      displayName: string;
      welcomeMessage?: string | null;
      socialLinks?: unknown;
    };
  },
  phrases: readonly string[],
): string[] {
  const listingHay = buildListingTextHaystack({
    requestItemName: row.requestItemName,
    storefrontItemBlurb: row.storefrontItemBlurb,
    listingSearchKeywords: row.listingSearchKeywords,
  });
  const shopHay = buildShopProfileHaystackFromSocialJson(
    row.shop.displayName,
    row.shop.welcomeMessage ?? null,
    row.shop.socialLinks ?? null,
  );
  const combined = `${listingHay}\n${shopHay}`;
  return findModerationMatches(combined, phrases);
}
