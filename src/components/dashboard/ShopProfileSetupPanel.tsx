"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import {
  updateShopListedOnShopsBrowseForm,
  updateShopProfileSetup,
  uploadShopProfileImageSetup,
  type ShopSetupActionResult,
} from "@/actions/dashboard-shop-setup";
import { ShopFlairSection } from "@/components/dashboard/ShopFlairSection";
import {
  SHOP_SOCIAL_KEYS,
  type ShopSocialKey,
  normalizedShopSocialUrl,
  parseShopSocialLinksJson,
  socialLinkAddValidationMessage,
  type ShopSocialLinksRecord,
} from "@/lib/shop-social-links";
import type { ShopSetupShopPayload } from "@/components/dashboard/ShopSetupTabs";
import {
  shopProfileModerationMatchesByField,
  moderationTriggerErrorMessage,
} from "@/lib/moderation-keyword-scan";
import { plainTextNoUrlsValidationError } from "@/lib/plain-text-no-urls";
import { shopDisplayNameForProfileForm } from "@/lib/shop-display-name-uniqueness";

type ProfileModerationBlurState = {
  displayName: string | null;
  welcome: string | null;
  socialByKey: Partial<Record<ShopSocialKey, string>>;
  socialAddDraft: string | null;
};

const emptyProfileModerationBlur: ProfileModerationBlurState = {
  displayName: null,
  welcome: null,
  socialByKey: {},
  socialAddDraft: null,
};

const SOCIAL_LABELS: Record<ShopSocialKey, string> = {
  reddit: "Reddit",
  x: "X",
  bluesky: "Bluesky",
  twitch: "Twitch",
  instagram: "Instagram",
};

function socialRecordFromShop(links: unknown): Record<ShopSocialKey, string> {
  const p = parseShopSocialLinksJson(links);
  return Object.fromEntries(SHOP_SOCIAL_KEYS.map((k) => [k, p[k] ?? ""])) as Record<
    ShopSocialKey,
    string
  >;
}

function buildShopProfileFormData(
  displayName: string,
  welcomeMessage: string,
  social: Record<ShopSocialKey, string>,
): FormData {
  const fd = new FormData();
  fd.set("displayName", displayName.trim());
  fd.set("welcomeMessage", welcomeMessage.trim());
  for (const k of SHOP_SOCIAL_KEYS) {
    fd.set(`social_${k}`, (social[k] ?? "").trim());
  }
  return fd;
}

const PROFILE_AUTOSAVE_DEBOUNCE_MS = 750;

function ProfileAutoSaveStatus({
  pending,
  savedFlash,
  dirty,
}: {
  pending: boolean;
  savedFlash: boolean;
  dirty: boolean;
}) {
  const label = pending ? "Saving…" : savedFlash && !dirty ? "Saved" : "\u00a0";
  return (
    <span
      className={`inline-block min-w-[4rem] text-right text-xs font-medium tabular-nums ${
        pending ? "text-zinc-400" : savedFlash && !dirty ? "text-emerald-400/90" : "text-transparent"
      }`}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function OnboardingCompleteCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="9" className="fill-current" />
      <path
        d="m8.5 12 2 2 5-5"
        className="stroke-black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfilePhotoPencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function initialsFromDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function SocialGlyph({ platform }: { platform: ShopSocialKey }) {
  const common =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300";
  const map: Record<ShopSocialKey, string> = {
    reddit: "R",
    x: "𝕏",
    bluesky: "bs",
    twitch: "Tw",
    instagram: "IG",
  };
  return <span className={common}>{map[platform]}</span>;
}

export function ShopProfileSetupPanel(props: {
  shop: ShopSetupShopPayload;
  r2Configured: boolean;
  stripePublishableKey?: string | null;
  mockListingFeeCheckout?: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
  moderationPhrases?: readonly string[];
  /** All shop onboarding checklist steps finished. */
  onboardingComplete?: boolean;
}) {
  const {
    shop,
    r2Configured,
    stripePublishableKey = null,
    mockListingFeeCheckout = false,
    embedded = false,
    moderationPhrases = [],
    onboardingComplete = false,
  } = props;

  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [profileModerationBlur, setProfileModerationBlur] =
    useState<ProfileModerationBlurState>(emptyProfileModerationBlur);

  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [isSocialSavePending, startSocialSaveTransition] = useTransition();
  const [isListedBrowsePending, startListedBrowseTransition] = useTransition();

  const [displayName, setDisplayName] = useState(() => shopDisplayNameForProfileForm(shop.displayName));
  const [listedOnShopsBrowse, setListedOnShopsBrowse] = useState(shop.listedOnShopsBrowse);
  const [welcomeMessage, setWelcomeMessage] = useState(shop.welcomeMessage ?? "");
  const [social, setSocial] = useState(() => socialRecordFromShop(shop.socialLinks));
  const [socialAddKey, setSocialAddKey] = useState<"" | ShopSocialKey>("");
  const [socialAddUrl, setSocialAddUrl] = useState("");
  const [socialAddError, setSocialAddError] = useState<string | null>(null);
  const [profileSavedFlash, setProfileSavedFlash] = useState(false);

  const [avatarSavedFlash, setAvatarSavedFlash] = useState(false);
  const [profileImageUrlOverride, setProfileImageUrlOverride] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputId = useId();
  const profileAutosaveGen = useRef(0);

  const profileImageUrl = profileImageUrlOverride ?? shop.profileImageUrl;

  useEffect(() => {
    profileAutosaveGen.current += 1;
    setDisplayName(shopDisplayNameForProfileForm(shop.displayName));
    setWelcomeMessage(shop.welcomeMessage ?? "");
    setSocial(socialRecordFromShop(shop.socialLinks));
    setListedOnShopsBrowse(shop.listedOnShopsBrowse);
    setProfileSavedFlash(false);
  }, [shop.shopSlug, shop.displayName, shop.welcomeMessage, shop.socialLinks, shop.listedOnShopsBrowse]);

  useEffect(() => {
    setProfileImageUrlOverride(null);
    setAvatarSavedFlash(false);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }, [shop.profileImageUrl]);

  const baselineSocial = useMemo(
    () => parseShopSocialLinksJson(shop.socialLinks),
    [shop.socialLinks],
  );

  const welcomeUrlError = useMemo(
    () => plainTextNoUrlsValidationError(welcomeMessage),
    [welcomeMessage],
  );

  const profileDirty = useMemo(() => {
    if (displayName.trim() !== shopDisplayNameForProfileForm(shop.displayName).trim()) return true;
    if (welcomeMessage.trim() !== (shop.welcomeMessage ?? "").trim()) return true;
    for (const k of SHOP_SOCIAL_KEYS) {
      if ((social[k] ?? "").trim() !== (baselineSocial[k] ?? "").trim()) return true;
    }
    return false;
  }, [displayName, welcomeMessage, social, shop.displayName, shop.welcomeMessage, baselineSocial]);

  const profileAutosaveBlocked = Boolean(welcomeUrlError) || !displayName.trim();

  useEffect(() => {
    if (profileDirty) setProfileSavedFlash(false);
  }, [profileDirty]);

  useEffect(() => {
    if (!profileDirty || profileAutosaveBlocked || isSocialSavePending) return;
    const gen = profileAutosaveGen.current;
    const t = window.setTimeout(() => {
      startProfileTransition(async () => {
        setMessage(null);
        const r: ShopSetupActionResult = await updateShopProfileSetup(
          buildShopProfileFormData(displayName, welcomeMessage, social),
        );
        if (gen !== profileAutosaveGen.current) return;
        if (r.ok) {
          setMessage(null);
          setProfileSavedFlash(true);
          window.setTimeout(() => setProfileSavedFlash(false), 2500);
          router.refresh();
        } else {
          setMessage({ tone: "err", text: r.error });
        }
      });
    }, PROFILE_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    profileDirty,
    profileAutosaveBlocked,
    displayName,
    welcomeMessage,
    social,
    isSocialSavePending,
    router,
  ]);

  useEffect(() => {
    setProfileModerationBlur(emptyProfileModerationBlur);
  }, [profileDirty]);

  useEffect(() => {
    setSocialAddError(null);
  }, [socialAddKey, socialAddUrl]);

  function persistSocialLinks(nextSocial: Record<ShopSocialKey, string>, prevSocial: Record<ShopSocialKey, string>) {
    startSocialSaveTransition(async () => {
      setMessage(null);
      const r: ShopSetupActionResult = await updateShopProfileSetup(
        buildShopProfileFormData(displayName, welcomeMessage, nextSocial),
      );
      if (!r.ok) {
        setSocial(prevSocial);
        setMessage({ tone: "err", text: r.error });
        return;
      }
      router.refresh();
    });
  }

  function setListedOnShopsBrowsePreference(next: boolean) {
    if (isListedBrowsePending || next === listedOnShopsBrowse) return;
    const prev = listedOnShopsBrowse;
    setListedOnShopsBrowse(next);
    startListedBrowseTransition(async () => {
      setMessage(null);
      const fd = new FormData();
      fd.set("listedOnShopsBrowse", next ? "true" : "false");
      const r: ShopSetupActionResult = await updateShopListedOnShopsBrowseForm(fd);
      if (!r.ok) {
        setListedOnShopsBrowse(prev);
        setMessage({ tone: "err", text: r.error });
        return;
      }
      router.refresh();
    });
  }

  async function handleAvatarSubmit(fd: FormData) {
    setMessage(null);
    startAvatarTransition(async () => {
      let r: ShopSetupActionResult;
      try {
        r = await uploadShopProfileImageSetup(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const actionResponseRace =
          /body exceeded|1\s*mb limit|413|payload too large/i.test(msg) ||
          /unexpected response was received from the server/i.test(msg) ||
          /An error occurred in the Server Components render/i.test(msg);
        setMessage({
          tone: "err",
          text: actionResponseRace
            ? "Upload failed — the photo may be over the server size limit (try under 5 MB), or the dashboard could not refresh after upload. Reload the page; if it still fails, redeploy so the 16 MB upload limit is active."
            : msg || "Could not upload that photo. Try again or contact support.",
        });
        if (avatarInputRef.current) avatarInputRef.current.value = "";
        return;
      }
      if (r.ok) {
        if (r.profileImageUrl?.trim()) {
          setProfileImageUrlOverride(r.profileImageUrl.trim());
        }
        setAvatarSavedFlash(true);
        window.setTimeout(() => setAvatarSavedFlash(false), 2500);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      } else {
        setMessage({ tone: "err", text: r.error });
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      }
    });
  }

  function uploadAvatarPickedFile(file: File) {
    if (isAvatarPending) return;
    setAvatarSavedFlash(false);
    setMessage(null);
    const fd = new FormData();
    fd.set("profileImage", file);
    void handleAvatarSubmit(fd);
  }

  function onAvatarFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "err", text: "Choose an image file (JPEG, PNG, WebP, or GIF)." });
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    uploadAvatarPickedFile(file);
  }

  function runShopProfileModerationCheck() {
    if (moderationPhrases.length === 0) {
      setProfileModerationBlur(emptyProfileModerationBlur);
      return;
    }
    const m = shopProfileModerationMatchesByField(
      {
        displayName,
        welcomeMessage,
        socialLinks: social as ShopSocialLinksRecord,
        socialAddDraftUrl: socialAddUrl,
      },
      moderationPhrases,
    );
    const socialByKey: Partial<Record<ShopSocialKey, string>> = {};
    for (const k of SHOP_SOCIAL_KEYS) {
      const h = m.socialByKey[k];
      if (h?.length) socialByKey[k] = moderationTriggerErrorMessage(h);
    }
    setProfileModerationBlur({
      displayName: m.displayName.length ? moderationTriggerErrorMessage(m.displayName) : null,
      welcome: m.welcome.length ? moderationTriggerErrorMessage(m.welcome) : null,
      socialByKey,
      socialAddDraft: m.socialAddDraft.length ? moderationTriggerErrorMessage(m.socialAddDraft) : null,
    });
  }

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Shop profile</h2>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-14 w-14 shrink-0">
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- R2 / external shop avatars
              <img
                src={profileImageUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-1 ring-zinc-700"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300 ring-1 ring-zinc-700"
                aria-hidden
              >
                {initialsFromDisplayName(shop.displayName)}
              </div>
            )}
            {profileImageUrl && r2Configured ? (
              <label
                htmlFor={avatarFileInputId}
                title="Change profile photo"
                className={`absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-zinc-200 shadow-sm ${
                  isAvatarPending
                    ? "pointer-events-none opacity-60"
                    : "cursor-pointer hover:border-zinc-500 hover:bg-zinc-700"
                }`}
              >
                <ProfilePhotoPencilIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Change profile photo</span>
              </label>
            ) : null}
            {isAvatarPending ? (
              <span
                className="absolute inset-0 flex items-center justify-center rounded-full bg-zinc-950/70 text-[10px] font-medium text-zinc-200"
                role="status"
                aria-live="polite"
              >
                …
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-zinc-100">{shop.displayName}</p>
            {avatarSavedFlash ? (
              <p className="mt-0.5 text-[11px] text-emerald-300/90" role="status">
                Photo saved
              </p>
            ) : null}
          </div>
        </div>

        {onboardingComplete ? (
          <p className="flex items-center gap-1.5 border-t border-zinc-800/60 pt-2.5 text-[11px] text-zinc-500">
            <OnboardingCompleteCheckIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span>Onboarding complete</span>
          </p>
        ) : null}

        {!profileImageUrl ? (
          <div className="border-t border-zinc-800/80 pt-3">
            <p className="text-xs text-zinc-500">Profile photo</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">No photo yet.</p>
            {!r2Configured ? (
              <p className="mt-2 text-xs text-amber-200/80">
                R2 uploads are not configured on this server — contact the platform operator.
              </p>
            ) : (
              <label
                htmlFor={avatarFileInputId}
                className={`mt-2 inline-block ${isAvatarPending ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
              >
                <span className="rounded border border-zinc-700 bg-zinc-900/40 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-zinc-500">
                  {isAvatarPending ? "Uploading…" : "Choose image"}
                </span>
              </label>
            )}
          </div>
        ) : null}

        {r2Configured ? (
          <input
            ref={avatarInputRef}
            id={avatarFileInputId}
            type="file"
            name="profileImage"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={isAvatarPending}
            onChange={onAvatarFileInputChange}
            className="sr-only"
          />
        ) : null}
      </div>

      <div className="mt-8 space-y-6 text-sm text-zinc-300">
        {message?.tone === "err" ? (
          <p
            className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
            role="alert"
          >
            {message.text}
          </p>
        ) : null}

        <div className="space-y-4">
          <label className="block text-xs text-zinc-500">
            <span className="flex items-center justify-between gap-3">
              <span>Shop Name</span>
              <ProfileAutoSaveStatus
                pending={isProfilePending}
                savedFlash={profileSavedFlash}
                dirty={profileDirty}
              />
            </span>
            <input
              name="displayName"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={runShopProfileModerationCheck}
              onFocus={runShopProfileModerationCheck}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
            {profileModerationBlur.displayName ? (
              <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                {profileModerationBlur.displayName}
              </p>
            ) : null}
          </label>
          <label className="block text-xs text-zinc-500">
            Welcome message (max 280 characters, no links)
            <textarea
              name="welcomeMessage"
              rows={1}
              maxLength={280}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              onBlur={runShopProfileModerationCheck}
              onFocus={runShopProfileModerationCheck}
              placeholder="A short hello for visitors…"
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
            {welcomeUrlError ? (
              <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                {welcomeUrlError}
              </p>
            ) : profileModerationBlur.welcome ? (
              <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                {profileModerationBlur.welcome}
              </p>
            ) : null}
          </label>
          {shop.flair ? (
            <ShopFlairSection
              flair={shop.flair}
              variant="selection"
              className=""
            />
          ) : null}
          <div className="border-t border-zinc-800 pt-4">
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span id={`shop-listed-browse-label-${shop.shopSlug}`} className="text-xs text-zinc-500">
                Store appears in “
                <Link
                  href="/shops"
                  prefetch={false}
                  className="font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300"
                >
                  All Shops
                </Link>
                ” list
              </span>
              <div
                role="radiogroup"
                aria-labelledby={`shop-listed-browse-label-${shop.shopSlug}`}
                className="flex flex-wrap gap-4"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name={`listedOnShopsBrowse-${shop.shopSlug}`}
                    checked={listedOnShopsBrowse}
                    disabled={isListedBrowsePending}
                    onChange={() => setListedOnShopsBrowsePreference(true)}
                    className="border-zinc-600 text-sky-600 focus:ring-sky-500/40"
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name={`listedOnShopsBrowse-${shop.shopSlug}`}
                    checked={!listedOnShopsBrowse}
                    disabled={isListedBrowsePending}
                    onChange={() => setListedOnShopsBrowsePreference(false)}
                    className="border-zinc-600 text-sky-600 focus:ring-sky-500/40"
                  />
                  No
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-xs font-medium text-zinc-500">Social links (optional)</p>
            <ul className="space-y-2">
              {SHOP_SOCIAL_KEYS.filter((key) => (social[key] ?? "").trim()).map((key) => (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-2"
                >
                  <SocialGlyph platform={key} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-zinc-400">{SOCIAL_LABELS[key]}</p>
                    <p className="truncate font-mono text-[11px] text-zinc-500">{social[key]}</p>
                    {profileModerationBlur.socialByKey[key] ? (
                      <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                        {profileModerationBlur.socialByKey[key]}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={isSocialSavePending}
                    className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      if (isSocialSavePending) return;
                      const prevSocial = { ...social };
                      const nextSocial = { ...social, [key]: "" };
                      setSocial(nextSocial);
                      persistSocialLinks(nextSocial, prevSocial);
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-[10rem] flex-1 text-xs text-zinc-500">
                Network
                <select
                  value={socialAddKey}
                  disabled={isSocialSavePending}
                  onChange={(e) => setSocialAddKey((e.target.value || "") as "" | ShopSocialKey)}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Choose a network…</option>
                  {SHOP_SOCIAL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {SOCIAL_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0 flex-1 text-xs text-zinc-500 sm:min-w-[12rem]">
                Profile URL
                <input
                  type="url"
                  value={socialAddUrl}
                  disabled={isSocialSavePending}
                  onChange={(e) => setSocialAddUrl(e.target.value)}
                  onFocus={runShopProfileModerationCheck}
                  onBlur={() => {
                    runShopProfileModerationCheck();
                    if (!socialAddKey || !socialAddUrl.trim()) {
                      setSocialAddError(null);
                      return;
                    }
                    setSocialAddError(socialLinkAddValidationMessage(socialAddKey, socialAddUrl));
                  }}
                  placeholder="https://…"
                  aria-invalid={socialAddError ? true : undefined}
                  className={`mt-1 block w-full rounded-lg border bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                    socialAddError ? "border-amber-700/80" : "border-zinc-700"
                  }`}
                />
                {profileModerationBlur.socialAddDraft ? (
                  <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                    {profileModerationBlur.socialAddDraft}
                  </p>
                ) : null}
              </label>
              <button
                type="button"
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!socialAddKey || !socialAddUrl.trim() || isSocialSavePending}
                onClick={() => {
                  if (!socialAddKey || !socialAddUrl.trim() || isSocialSavePending) return;
                  const err = socialLinkAddValidationMessage(socialAddKey, socialAddUrl);
                  if (err) {
                    setSocialAddError(err);
                    return;
                  }
                  const stored = normalizedShopSocialUrl(socialAddUrl);
                  if (!stored) {
                    setSocialAddError("Enter a valid http(s) URL.");
                    return;
                  }
                  setSocialAddError(null);
                  const prevSocial = { ...social };
                  const nextSocial = { ...social, [socialAddKey]: stored };
                  setSocial(nextSocial);
                  setSocialAddUrl("");
                  setSocialAddKey("");
                  persistSocialLinks(nextSocial, prevSocial);
                }}
              >
                {isSocialSavePending ? "Saving…" : "Add link"}
              </button>
            </div>
            {socialAddError ? (
              <p className="text-xs text-red-400/90" role="alert">
                {socialAddError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
