"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  abandonUnconfirmedListingRequestSubmit,
  submitFirstListingSetup,
  type ShopSetupActionResult,
} from "@/actions/dashboard-shop-setup";
import { ItemGuidelinesPopup } from "@/components/ItemGuidelinesPopup";
import { ListingSearchKeywordsChipInput } from "@/components/dashboard/ListingSearchKeywordsChipInput";
import { ListingArtworkCropDialog } from "@/components/dashboard/ListingArtworkCropDialog";
import { ListingArtworkComposeDialog } from "@/components/dashboard/ListingArtworkComposeDialog";
import { ListingArtworkSurfaceTabs } from "@/components/dashboard/ListingArtworkSurfaceTabs";
import { ListingPillowDoubleSidedFields } from "@/components/dashboard/ListingPillowDoubleSidedFields";
import { CATALOG_CANVAS_PRESENTATION_FLAT } from "@/lib/admin-catalog-canvas-presentation";
import {
  catalogItemIsCanvasPrint,
  catalogItemIsBlackMug,
  catalogItemIsWhiteMug,
  listingArtworkLetterboxPreviewStyle,
} from "@/lib/listing-artwork-letterbox-fill";
import { catalogItemUsesRoundedCornerCropGuide } from "@/lib/listing-artwork-playing-card-crop";
import {
  buildListingArtworkBakedSubmitEntries,
  catalogItemIsPillow,
  resolvePillowListingArtworkSurfaces,
  type PillowSidesArtworkMode,
} from "@/lib/listing-artwork-pillow-listing";
import { ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import { flattenShopBaselineCatalogGroups, partitionShopBaselineCatalogGroups, type ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import {
  CATALOG_ARTWORK_SOURCE_TIER_GUIDANCE,
  CATALOG_ARTWORK_SOURCE_TIER_LABELS,
} from "@/lib/listing-artwork-source-tier";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";
import { SHOP_LISTING_MAX_PRICE_CENTS, shopListingMaxPriceUsdLabel } from "@/lib/marketplace-constants";
import {
  listingArtworkFileWithinUploadCap,
  listingArtworkUploadCapError,
  listingRequestArtworkUploadMaxBytes,
  listingRequestArtworkUploadMaxMb,
} from "@/lib/listing-request-artwork-limits";
import { bakeListingArtworkV2Client } from "@/lib/listing-artwork-v2/bake-client";
import {
  shopInReviewListingRequestLimitError,
  shopInReviewListingRequestLimitReached,
} from "@/lib/listing-request-review-limit";
import {
  listingArtworkBakedPreviewApiUrl,
  listingArtworkSourceMaxBytesForPrintArea,
  listingArtworkUploadV2Enabled,
  listingArtworkV2SourceCapError,
  listingArtworkV2SourceWithinCap,
} from "@/lib/listing-artwork-v2/limits";
import { uploadListingArtworkSourceToR2 } from "@/lib/listing-artwork-v2/upload-client";
import { bakeListingArtworkFromStagingClient } from "@/lib/listing-artwork-bake-client";
import { uploadListingArtworkFileToStaging } from "@/lib/listing-artwork-staging-upload-client";
import { LISTING_UPLOAD_CRASH_ERROR } from "@/lib/listing-request-submit-errors";
import {
  compressListingArtworkFileIfNeeded,
  compressListingArtworkSourceForStagingUpload,
  normalizeListingArtworkSourceFileForCrop,
} from "@/lib/listing-artwork-source-compress";
import { exportedImageMeetsPrintDimensions } from "@/lib/listing-artwork-print-area";
import { expectedShopProfitMerchandiseUnitCents } from "@/lib/marketplace-fee";
import { parseKeywordTokensFromStored } from "@/lib/search-keywords-normalize";
import {
  listingModerationMatchesByFieldForUi,
  listingRequestItemNameForHaystack,
  moderationTriggerErrorMessage,
} from "@/lib/moderation-keyword-scan";
import { ListingCreditPackSection } from "@/components/dashboard/ListingCreditPackSection";
import { ListingEstProfitBreakdownHelp } from "@/components/dashboard/DashboardListingForms";
import type { UnpaidPublicationFeeListingRow } from "@/lib/listing-fee-unpaid-rows";
import type { FreeListingRequestSlotsSummary } from "@/lib/marketplace-constants";

const STOREFRONT_ITEM_BLURB_MAX = 280;

type SurfaceArtworkEntry = { requestImageKey: string; publicUrl: string };

const btnPrimary =
  "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed";
const btnPrimaryDisabled = "rounded-lg bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-500 ring-1 ring-zinc-800";
const btnPrimarySaving =
  "cursor-wait rounded-lg bg-zinc-100/70 px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300/60";
const btnPrimarySaved =
  "cursor-default rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-800/40";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, cents) / 100);
}

function listingProfitHint(
  priceDollarsStr: string,
  minPriceCents: number,
  goodsServicesUnitCents: number,
): string | null {
  const parsed = parseFloat(priceDollarsStr.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  if (cents < minPriceCents) return null;
  const profit = expectedShopProfitMerchandiseUnitCents({
    listPriceCents: cents,
    goodsServicesUnitCents,
  });
  return `Est. profit: ${formatUsdFromCents(profit)}`;
}

function CatalogItemPhotoLink({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const linkClassName =
    "text-[11px] text-blue-400/90 underline underline-offset-2 hover:text-blue-300";

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <span className="flex w-full items-center justify-center">
        <button
          type="button"
          title="View item photo"
          className={linkClassName}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          Photo
        </button>
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="Close item photo preview"
                className="fixed inset-0 bg-black/70"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative z-[61] max-h-[min(85vh,720px)] max-w-[min(92vw,640px)] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label="Close"
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 shadow-sm backdrop-blur-sm transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
                <h3 id={titleId} className="sr-only">
                  Item photo
                </h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={href}
                  alt="Item photo preview"
                  className="max-h-[min(85vh,720px)] w-full bg-zinc-900 object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Shared row: item name (left) | item photo + sale price (right-aligned group) */
const CATALOG_PICKER_ROW = "flex items-center gap-x-4";
const CATALOG_PICKER_ITEM_COL = "min-w-0 max-w-[20rem] sm:max-w-[24rem]";
const CATALOG_PICKER_ITEM_HEADER_COL = `${CATALOG_PICKER_ITEM_COL} pl-7`;
const CATALOG_PICKER_TRAILING_COLS =
  "ml-auto grid shrink-0 grid-cols-[7rem_8rem] items-center gap-x-4 sm:grid-cols-[7.5rem_8.5rem]";
const CATALOG_PICKER_PHOTO_COL = "text-center text-[11px] leading-tight";
const CATALOG_PICKER_PRICE_COL = "text-center text-[11px] tabular-nums leading-tight";
const CATALOG_PICKER_HEADER_ROW = `${CATALOG_PICKER_ROW} sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-100`;
const CATALOG_PICKER_SECTION_ROW = `${CATALOG_PICKER_ROW} sticky top-8 z-10 border-b border-zinc-800/80 bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500`;
const catalogPickerHeaderMutedClass = (muted: boolean) => (muted ? " opacity-45" : "");

async function probeDashboardListingCount(): Promise<number | null> {
  for (const delayMs of [0, 400, 1200]) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      const r = await fetch("/api/dashboard/listings", { credentials: "same-origin" });
      if (!r.ok) continue;
      const data = (await r.json()) as { listings?: unknown[] };
      return data.listings?.length ?? 0;
    } catch {
      /* retry */
    }
  }
  return null;
}

export function ShopFirstListingRequestPanel(props: {
  catalogGroups: ShopSetupCatalogGroup[];
  r2Configured: boolean;
  listingPickerDiagnostics?: { adminCatalogItemCount: number };
  draftListingRequestPrefill?: DraftListingRequestPrefillPayload | null;
  /** When the next listing request needs a listing credit, show credit consent in the dialog. */
  needsListingCreditForNextRequest?: boolean;
  /** Listings currently in admin review (submitted / images ok / printify step). */
  inReviewListingRequestCount?: number;
  unpaidPublicationFeeListings?: UnpaidPublicationFeeListingRow[];
  freeListingSlots?: FreeListingRequestSlotsSummary;
  mockListingFeeCheckout?: boolean;
  stripePublishableKey?: string | null;
  embedded?: boolean;
  moderationPhrases?: readonly string[];
  /** After a successful submit — e.g. switch to Listings tab and refresh server onboarding state. */
  onListingSubmittedSuccess?: () => void;
  /** Listings already on the shop before submit — used to detect success after transport/RSC errors. */
  knownListingCount?: number;
}) {
  const {
    catalogGroups,
    r2Configured,
    listingPickerDiagnostics,
    draftListingRequestPrefill = null,
    needsListingCreditForNextRequest = false,
    inReviewListingRequestCount = 0,
    unpaidPublicationFeeListings = [],
    freeListingSlots = {
      cap: 3,
      remaining: 3,
      listingCreditsAvailable: 0,
      founderUnlimited: false,
    },
    mockListingFeeCheckout = false,
    stripePublishableKey = null,
    embedded,
    moderationPhrases = [],
    onListingSubmittedSuccess,
    knownListingCount = 0,
  } = props;

  const [isListingPending, startListingTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [listingItemNameModerationBlurError, setListingItemNameModerationBlurError] = useState<
    string | null
  >(null);
  const [listingBlurbModerationBlurError, setListingBlurbModerationBlurError] = useState<string | null>(
    null,
  );
  const [listingKeywordsModerationBlurError, setListingKeywordsModerationBlurError] = useState<
    string | null
  >(null);

  const [listingProductId, setListingProductId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingRequestItemName, setListingRequestItemName] = useState("");
  const [listingHasFile, setListingHasFile] = useState(false);
  const [listingSubmitArtworkFile, setListingSubmitArtworkFile] = useState<File | null>(null);
  const [surfaceArtwork, setSurfaceArtwork] = useState<Record<string, SurfaceArtworkEntry>>({});
  const [activeSurfaceId, setActiveSurfaceId] = useState("front");
  const [pillowDoubleSided, setPillowDoubleSided] = useState(false);
  const [pillowSidesMode, setPillowSidesMode] = useState<PillowSidesArtworkMode>("same");
  const [listingSourceKey, setListingSourceKey] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [composeImageUrl, setComposeImageUrl] = useState<string | null>(null);
  const [cropSourceObjectUrl, setCropSourceObjectUrl] = useState<string | null>(null);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [listingArtworkPreviewUrl, setListingArtworkPreviewUrl] = useState<string | null>(null);
  const [listingArtworkPixels, setListingArtworkPixels] = useState<{ w: number; h: number } | null>(null);
  const [listingArtworkMeasureError, setListingArtworkMeasureError] = useState<string | null>(null);
  const [artworkUploadProgress, setArtworkUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [artworkSourcePreparing, setArtworkSourcePreparing] = useState(false);
  const [artworkBaking, setArtworkBaking] = useState(false);
  const [listingSavedFlash, setListingSavedFlash] = useState(false);
  const [listingStorefrontBlurb, setListingStorefrontBlurb] = useState("");
  const [keywordTokens, setKeywordTokens] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keywordDuplicateHint, setKeywordDuplicateHint] = useState<string | null>(null);
  const listingFileRef = useRef<HTMLInputElement>(null);
  const surfaceArtworkRef = useRef(surfaceArtwork);
  surfaceArtworkRef.current = surfaceArtwork;
  const activeSurfaceIdRef = useRef(activeSurfaceId);
  activeSurfaceIdRef.current = activeSurfaceId;
  const listingSourceKeyRef = useRef(listingSourceKey);
  listingSourceKeyRef.current = listingSourceKey;
  const artworkUploadV2 = listingArtworkUploadV2Enabled();
  const prefillAppliedListingIdRef = useRef<string | null>(null);
  const pendingListingFdRef = useRef<FormData | null>(null);
  const [attestationOpen, setAttestationOpen] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [feeChargeConsentChecked, setFeeChargeConsentChecked] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const listingRequestFormId = useId();
  const storefrontPitchFieldId = useId();
  const listingKeywordsInputId = useId();

  const keywordsJoined = useMemo(() => keywordTokens.join(" "), [keywordTokens]);

  useEffect(() => {
    if (attestationOpen) {
      setAttestationChecked(false);
      setFeeChargeConsentChecked(false);
    }
  }, [attestationOpen]);

  const listingCreditConsentRequired = needsListingCreditForNextRequest;
  const shopAtInReviewListingLimit = shopInReviewListingRequestLimitReached(inReviewListingRequestCount);
  const feeConsentOk = !listingCreditConsentRequired || feeChargeConsentChecked;

  const catalogOptions = useMemo(
    () => flattenShopBaselineCatalogGroups(catalogGroups),
    [catalogGroups],
  );

  const catalogGroupsByTier = useMemo(
    () => partitionShopBaselineCatalogGroups(catalogGroups),
    [catalogGroups],
  );

  const selectedCatalogGroup = useMemo(() => {
    for (const g of catalogGroups) {
      if (g.option.productId === listingProductId) return g;
    }
    return null;
  }, [catalogGroups, listingProductId]);

  const catalogArtworkSurfaces = selectedCatalogGroup?.option.artworkSurfaces ?? [];
  const isPillowItem = useMemo(
    () =>
      catalogItemIsPillow({
        catalogItemName: selectedCatalogGroup?.itemName,
        categoryTagSlug: selectedCatalogGroup?.categoryTag?.slug,
      }),
    [selectedCatalogGroup?.itemName, selectedCatalogGroup?.categoryTag?.slug],
  );
  const adminPillowDualSided = isPillowItem && catalogArtworkSurfaces.length > 1;
  const pillowDoubleSidedEffective = isPillowItem && (adminPillowDualSided || pillowDoubleSided);
  const { surfaces: artworkSurfaces, duplicateFrontToBackOnSubmit } = useMemo(() => {
    if (!isPillowItem) {
      return { surfaces: catalogArtworkSurfaces, duplicateFrontToBackOnSubmit: false };
    }
    return resolvePillowListingArtworkSurfaces({
      catalogSurfaces: catalogArtworkSurfaces,
      pillowDoubleSided: pillowDoubleSidedEffective,
      pillowSidesMode,
    });
  }, [
    isPillowItem,
    catalogArtworkSurfaces,
    pillowDoubleSidedEffective,
    pillowSidesMode,
  ]);
  const activeSurface = useMemo(() => {
    return artworkSurfaces.find((s) => s.id === activeSurfaceId) ?? artworkSurfaces[0] ?? null;
  }, [artworkSurfaces, activeSurfaceId]);
  const activeSurfaceArtwork = activeSurface ? surfaceArtwork[activeSurface.id] ?? null : null;
  const isMultiSurfaceArtwork = artworkSurfaces.length > 1;

  const printAreaW = activeSurface?.printAreaWidthPx ?? selectedCatalogGroup?.option.printAreaWidthPx ?? null;
  const printAreaH = activeSurface?.printAreaHeightPx ?? selectedCatalogGroup?.option.printAreaHeightPx ?? null;
  const canvasPresentation = activeSurface?.canvasPresentation ?? CATALOG_CANVAS_PRESENTATION_FLAT;
  const isCanvasPrintItem = useMemo(
    () =>
      catalogItemIsCanvasPrint({
        catalogItemName: selectedCatalogGroup?.itemName,
        categoryTagSlug: selectedCatalogGroup?.categoryTag?.slug,
      }),
    [selectedCatalogGroup?.itemName, selectedCatalogGroup?.categoryTag?.slug],
  );
  const showBlackMugBackgroundTip = useMemo(
    () => catalogItemIsBlackMug({ catalogItemName: selectedCatalogGroup?.itemName }),
    [selectedCatalogGroup?.itemName],
  );
  const showWhiteMugBackgroundTip = useMemo(
    () => catalogItemIsWhiteMug({ catalogItemName: selectedCatalogGroup?.itemName }),
    [selectedCatalogGroup?.itemName],
  );
  const showRoundedCornerCropGuide = useMemo(
    () =>
      catalogItemUsesRoundedCornerCropGuide({
        catalogItemName: selectedCatalogGroup?.itemName,
        categoryTagSlug: selectedCatalogGroup?.categoryTag?.slug,
        printAreaWidthPx: printAreaW,
        printAreaHeightPx: printAreaH,
      }),
    [selectedCatalogGroup?.itemName, selectedCatalogGroup?.categoryTag?.slug, printAreaW, printAreaH],
  );
  const surfaceLabelForDialog = isMultiSurfaceArtwork ? activeSurface?.label : undefined;
  const listingArtworkV2SourceMaxBytes = useMemo(
    () =>
      listingArtworkSourceMaxBytesForPrintArea(
        printAreaW,
        printAreaH,
        selectedCatalogGroup?.itemName ?? null,
      ),
    [printAreaW, printAreaH, selectedCatalogGroup?.itemName],
  );
  const listingArtworkV2SourceMaxMb = listingArtworkV2SourceMaxBytes / (1024 * 1024);

  function replaceListingArtworkPreviewUrl(next: string | null) {
    setListingArtworkPreviewUrl((prev) => {
      if (prev?.startsWith("blob:") && prev !== next) {
        URL.revokeObjectURL(prev);
      }
      return next;
    });
  }

  function handlePillowDoubleSidedChange(next: boolean) {
    setPillowDoubleSided(next);
    if (!next) {
      setSurfaceArtworkForId("back", null);
      if (activeSurfaceIdRef.current === "back") {
        selectArtworkSurface("front");
      }
    }
  }

  function handlePillowSidesModeChange(next: PillowSidesArtworkMode) {
    setPillowSidesMode(next);
    if (next === "same") {
      setSurfaceArtworkForId("back", null);
      if (activeSurfaceIdRef.current === "back") {
        selectArtworkSurface("front");
      }
    }
  }

  function setSurfaceArtworkForId(surfaceId: string, entry: SurfaceArtworkEntry | null) {
    setSurfaceArtwork((prev) => {
      if (!entry) {
        if (!prev[surfaceId]) return prev;
        const next = { ...prev };
        delete next[surfaceId];
        return next;
      }
      return { ...prev, [surfaceId]: entry };
    });
  }

  function selectArtworkSurface(surfaceId: string) {
    setActiveSurfaceId(surfaceId);
    const entry = surfaceArtworkRef.current[surfaceId];
    if (entry) {
      replaceListingArtworkPreviewUrl(listingArtworkBakedPreviewApiUrl(entry.requestImageKey));
      setListingHasFile(true);
    } else {
      replaceListingArtworkPreviewUrl(null);
      setListingHasFile(false);
    }
    if (listingFileRef.current) listingFileRef.current.value = "";
  }

  useEffect(() => {
    if (!listingArtworkPreviewUrl) {
      setListingArtworkPixels(null);
      return;
    }
    setListingArtworkMeasureError(null);

    if (activeSurfaceArtwork && printAreaW != null && printAreaH != null) {
      setListingArtworkPixels({ w: printAreaW, h: printAreaH });
      return;
    }

    setListingArtworkPixels(null);
    const img = new Image();
    img.onload = () => {
      setListingArtworkPixels({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      setListingArtworkPixels(null);
      setListingArtworkMeasureError(
        "Could not read this image. Use a PNG or JPEG the browser can open.",
      );
    };
    img.src = listingArtworkPreviewUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [listingArtworkPreviewUrl, activeSurfaceArtwork, printAreaW, printAreaH]);

  const surfaceArtworkReady = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const surface of artworkSurfaces) {
      out[surface.id] = surfaceArtwork[surface.id] != null;
    }
    return out;
  }, [artworkSurfaces, surfaceArtwork]);

  useEffect(() => {
    if (
      listingProductId ||
      listingPrice ||
      listingRequestItemName ||
      listingHasFile ||
      listingStorefrontBlurb ||
      keywordTokens.length > 0 ||
      keywordDraft
    ) {
      setListingSavedFlash(false);
    }
  }, [
    listingProductId,
    listingPrice,
    listingRequestItemName,
    listingHasFile,
    listingStorefrontBlurb,
    keywordTokens.length,
    keywordDraft,
  ]);

  const listingArtworkUploadMaxMb = listingRequestArtworkUploadMaxMb();
  const listingArtworkUploadMaxBytes = listingRequestArtworkUploadMaxBytes();

  async function applyListingArtworkPickedFile(file: File) {
    setListingSubmitArtworkFile(null);
    const surfaceId = activeSurfaceIdRef.current;
    setSurfaceArtworkForId(surfaceId, null);
    setListingSourceKey(null);
    setListingArtworkMeasureError(null);
    const uploadCapOk = artworkUploadV2
      ? listingArtworkV2SourceWithinCap(file.size, listingArtworkV2SourceMaxBytes)
      : listingArtworkFileWithinUploadCap(file.size);
    if (!uploadCapOk) {
      setListingHasFile(false);
      setListingArtworkPreviewUrl(null);
      setListingArtworkMeasureError(
        artworkUploadV2
          ? listingArtworkV2SourceCapError(listingArtworkV2SourceMaxBytes)
          : listingArtworkUploadCapError(),
      );
      if (listingFileRef.current) listingFileRef.current.value = "";
      return;
    }
    const pw = selectedCatalogGroup?.option.printAreaWidthPx ?? null;
    const ph = selectedCatalogGroup?.option.printAreaHeightPx ?? null;
    const needCrop = pw != null && ph != null && pw > 0 && ph > 0;

    if (needCrop && artworkUploadV2) {
      if (!listingProductId) {
        setListingArtworkMeasureError("Select a catalog item before uploading artwork.");
        if (listingFileRef.current) listingFileRef.current.value = "";
        return;
      }
      setSurfaceArtworkForId(surfaceId, null);
      setListingSourceKey(null);
      setComposeImageUrl(null);
      setArtworkSourcePreparing(true);
      try {
        const upload = await uploadListingArtworkSourceToR2(
          file,
          listingProductId,
          (loaded, total) => {
            setArtworkUploadProgress({ current: loaded, total });
          },
          listingArtworkV2SourceMaxBytes,
        );
        setArtworkUploadProgress(null);
        if (!upload.ok) {
          setListingArtworkMeasureError(upload.error);
          setListingHasFile(false);
          if (listingFileRef.current) listingFileRef.current.value = "";
          return;
        }
        setListingSourceKey(upload.sourceKey);
        setComposeImageUrl(upload.previewGetUrl);
        setComposeDialogOpen(true);
        setListingHasFile(false);
        setListingArtworkPreviewUrl(null);
      } finally {
        setArtworkSourcePreparing(false);
        setArtworkUploadProgress(null);
      }
      return;
    }

    if (needCrop) {
      setSurfaceArtworkForId(surfaceId, null);
      setArtworkSourcePreparing(true);
      try {
        const normalized = await normalizeListingArtworkSourceFileForCrop(file);
        if (!normalized.ok) {
          setListingHasFile(false);
          setListingArtworkPreviewUrl(null);
          setListingArtworkMeasureError(normalized.error);
          if (listingFileRef.current) listingFileRef.current.value = "";
          return;
        }
        setCropSourceFile(normalized.file);
        setCropSourceObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(normalized.file);
        });
        setCropDialogOpen(true);
        setListingHasFile(false);
        setListingArtworkPreviewUrl(null);
      } finally {
        setArtworkSourcePreparing(false);
      }
      return;
    }

    setArtworkSourcePreparing(true);
    try {
      const prepared = await compressListingArtworkFileIfNeeded(file);
      if (!prepared.ok) {
        setListingHasFile(false);
        setListingArtworkPreviewUrl(null);
        setListingArtworkMeasureError(prepared.error);
        return;
      }
      const ready = prepared.file;
      setListingSubmitArtworkFile(ready);
      setListingHasFile(true);
      replaceListingArtworkPreviewUrl(URL.createObjectURL(ready));
    } finally {
      setArtworkSourcePreparing(false);
    }
  }

  useEffect(() => {
    const staleEntries = Object.values(surfaceArtworkRef.current);
    const staleSourceKey = listingSourceKeyRef.current;
    for (const entry of staleEntries) {
      void abandonUnconfirmedListingRequestSubmit(null, entry.requestImageKey, staleSourceKey);
    }
    if (staleSourceKey && staleEntries.length === 0) {
      void abandonUnconfirmedListingRequestSubmit(null, null, staleSourceKey);
    }
    setListingSubmitArtworkFile(null);
    setSurfaceArtwork({});
    setActiveSurfaceId(() => {
      for (const g of catalogGroups) {
        if (g.option.productId === listingProductId) {
          return g.option.artworkSurfaces[0]?.id ?? "front";
        }
      }
      return "front";
    });
    setListingSourceKey(null);
    setListingHasFile(false);
    setListingArtworkPreviewUrl(null);
    setCropDialogOpen(false);
    setComposeDialogOpen(false);
    setComposeImageUrl(null);
    setCropSourceFile(null);
    setCropSourceObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (listingFileRef.current) listingFileRef.current.value = "";
    setListingStorefrontBlurb("");
    setKeywordTokens([]);
    setKeywordDraft("");
    setKeywordDuplicateHint(null);
    setListingItemNameModerationBlurError(null);
    setListingBlurbModerationBlurError(null);
    setListingKeywordsModerationBlurError(null);
    setPillowDoubleSided(false);
    setPillowSidesMode("same");
  }, [listingProductId, catalogGroups]);

  useEffect(() => {
    if (adminPillowDualSided) {
      setPillowDoubleSided(true);
    }
  }, [listingProductId, adminPillowDualSided]);

  useEffect(() => {
    if (!listingProductId) {
      setListingPrice("");
      return;
    }
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (!o) return;
    setListingPrice((o.minPriceCents / 100).toFixed(2));
  }, [listingProductId, catalogOptions]);

  useEffect(() => {
    if (!draftListingRequestPrefill) {
      prefillAppliedListingIdRef.current = null;
    }
  }, [draftListingRequestPrefill]);

  useEffect(() => {
    if (!draftListingRequestPrefill || catalogGroups.length === 0) return;
    if (prefillAppliedListingIdRef.current === draftListingRequestPrefill.listingId) return;
    prefillAppliedListingIdRef.current = draftListingRequestPrefill.listingId;
    setListingProductId(draftListingRequestPrefill.catalogProductPick);
  }, [draftListingRequestPrefill, catalogGroups.length]);

  useEffect(() => {
    const p = draftListingRequestPrefill;
    if (!p || catalogGroups.length === 0) return;
    if (prefillAppliedListingIdRef.current !== p.listingId) return;
    if (listingProductId !== p.catalogProductPick) return;
    if (p.listingPriceDollars != null) {
      setListingPrice(p.listingPriceDollars);
    }
    setListingRequestItemName(p.requestItemName);
    setListingStorefrontBlurb((p.storefrontItemBlurb ?? "").trim());
    setKeywordTokens(parseKeywordTokensFromStored(p.listingSearchKeywords));
    setKeywordDraft("");
    setKeywordDuplicateHint(null);
  }, [draftListingRequestPrefill, catalogGroups.length, listingProductId]);

  const listingPriceMeetsMinimum = useMemo(() => {
    if (!listingProductId) return false;
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (!o) return false;
    const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return false;
    const cents = Math.round(parsed * 100);
    return cents >= o.minPriceCents && cents <= SHOP_LISTING_MAX_PRICE_CENTS;
  }, [listingProductId, catalogOptions, listingPrice]);

  /** True while the field value parses above the platform max (before blur clamps). */
  const listingPriceOverMax = useMemo(() => {
    const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return false;
    return Math.round(parsed * 100) > SHOP_LISTING_MAX_PRICE_CENTS;
  }, [listingPrice]);

  async function prepareListingArtworkFormData(
    fd: FormData,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (fd.get("listingArtworkBakedKey") || fd.get("listingArtworkBakedEntriesJson")) {
      return { ok: true };
    }

    const art = fd.get("listingArtwork");
    if (!(art instanceof File) || art.size === 0) {
      return { ok: false, error: "Upload a print-ready artwork file." };
    }
    if (!listingArtworkFileWithinUploadCap(art.size)) {
      return { ok: false, error: listingArtworkUploadCapError() };
    }

    const upload = await uploadListingArtworkFileToStaging(art, (current, total) => {
      setArtworkUploadProgress({ current, total });
    });
    setArtworkUploadProgress(null);
    if (!upload.ok) return upload;

    fd.delete("listingArtwork");
    fd.set("listingArtworkStagingKey", upload.stagingKey);
    return { ok: true };
  }

  async function handleListingSubmit(fd: FormData) {
    setMessage(null);
    setListingItemNameModerationBlurError(null);
    setListingBlurbModerationBlurError(null);
    setListingKeywordsModerationBlurError(null);
    const listingCountBefore = knownListingCount;
    startListingTransition(async () => {
      const artworkPrep = await prepareListingArtworkFormData(fd);
      if (!artworkPrep.ok) {
        setMessage({ tone: "err", text: artworkPrep.error });
        return;
      }

      function clearListingFormAfterSuccess() {
        setListingProductId("");
        setListingPrice("");
        setListingRequestItemName("");
        setListingStorefrontBlurb("");
        setKeywordTokens([]);
        setKeywordDraft("");
        setKeywordDuplicateHint(null);
        setListingHasFile(false);
        setListingSubmitArtworkFile(null);
        setSurfaceArtwork({});
        setActiveSurfaceId("front");
        setListingSourceKey(null);
        setComposeDialogOpen(false);
        setComposeImageUrl(null);
        setListingArtworkPreviewUrl(null);
        if (listingFileRef.current) listingFileRef.current.value = "";
      }

      async function finishListingSubmitSuccess(successText: string) {
        setMessage({ tone: "ok", text: successText });
        setListingSavedFlash(true);
        window.setTimeout(() => setListingSavedFlash(false), 2500);
        clearListingFormAfterSuccess();
        if (onListingSubmittedSuccess) {
          onListingSubmittedSuccess();
        }
      }

      async function failUnconfirmedSubmit(bakedKey: string | null) {
        try {
          await abandonUnconfirmedListingRequestSubmit(null, bakedKey);
        } catch {
          /* best-effort cleanup */
        }
        setMessage({ tone: "err", text: LISTING_UPLOAD_CRASH_ERROR });
      }

      async function recoverFromSubmitTransportError(bakedKey: string | null): Promise<boolean> {
        if (onListingSubmittedSuccess) onListingSubmittedSuccess();
        const countAfter = await probeDashboardListingCount();
        if (countAfter != null && countAfter > listingCountBefore) {
          await finishListingSubmitSuccess("Listing submitted. Check the Listings tab for status.");
          return true;
        }
        await failUnconfirmedSubmit(bakedKey);
        return false;
      }

      const bakedKey = String(fd.get("listingArtworkBakedKey") ?? "").trim() || null;

      let r: ShopSetupActionResult;
      try {
        r = await submitFirstListingSetup(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const bodyTooLarge =
          /body exceeded|1\s*mb limit|413|payload too large/i.test(msg) ||
          /unexpected response was received from the server/i.test(msg);
        const rscRenderFailure = /error occurred in the Server Components render/i.test(msg);
        if (rscRenderFailure || bodyTooLarge) {
          const recovered = await recoverFromSubmitTransportError(bakedKey);
          if (recovered) return;
          return;
        }
        await failUnconfirmedSubmit(bakedKey);
        return;
      }
      if (r.ok) {
        await finishListingSubmitSuccess(r.message ?? "Listing submitted.");
      } else if (r.error === LISTING_UPLOAD_CRASH_ERROR) {
        await failUnconfirmedSubmit(bakedKey);
      } else {
        setMessage({ tone: "err", text: r.error });
      }
    });
  }

  function runRequestListingTextModerationBlur() {
    if (moderationPhrases.length === 0) {
      setListingItemNameModerationBlurError(null);
      setListingBlurbModerationBlurError(null);
      setListingKeywordsModerationBlurError(null);
      return;
    }
    const catalogProductName = selectedCatalogGroup?.itemName?.trim() ?? "";
    const kwParts = [keywordsJoined, keywordDraft.trim()].filter(Boolean);
    const kws = kwParts.length > 0 ? kwParts.join(" ") : null;
    const by = listingModerationMatchesByFieldForUi({
      phrases: moderationPhrases,
      requestItemNameForHaystack: listingRequestItemNameForHaystack(
        listingRequestItemName.trim(),
        catalogProductName,
      ),
      storefrontBlurbForHaystack: listingStorefrontBlurb.trim() || null,
      searchKeywordsForHaystack: kws,
      itemNameVisible: listingRequestItemName,
      blurbVisible: listingStorefrontBlurb.trim(),
      keywordsVisible: kwParts.length > 0 ? kwParts.join(" ") : "",
    });
    setListingItemNameModerationBlurError(
      by.itemName.length > 0 ? moderationTriggerErrorMessage(by.itemName) : null,
    );
    setListingBlurbModerationBlurError(
      by.storefrontBlurb.length > 0 ? moderationTriggerErrorMessage(by.storefrontBlurb) : null,
    );
    setListingKeywordsModerationBlurError(
      by.keywords.length > 0 ? moderationTriggerErrorMessage(by.keywords) : null,
    );
  }

  const listingRequestItemNameOk = listingRequestItemName.trim().length > 0;
  const requiresPrintCrop = Boolean(
    printAreaW != null && printAreaH != null && printAreaW > 0 && printAreaH > 0,
  );
  const minArtworkDpi = selectedCatalogGroup?.option.minArtworkDpi ?? null;
  const artworkLetterboxFill = selectedCatalogGroup?.option.artworkLetterboxFill;
  const artworkPreviewStyle = useMemo(
    () => listingArtworkLetterboxPreviewStyle(artworkLetterboxFill),
    [artworkLetterboxFill],
  );
  const listingArtworkFileSizeError = (() => {
    const f = listingSubmitArtworkFile;
    if (f && !listingArtworkFileWithinUploadCap(f.size)) {
      return listingArtworkUploadCapError();
    }
    return null;
  })();
  const printExportDimensionsError = (() => {
    if (!requiresPrintCrop || !listingArtworkPixels) return null;
    if (activeSurfaceArtwork != null) return null;
    if (listingSubmitArtworkFile == null) return null;
    if (printAreaW == null || printAreaH == null) return null;
    if (!exportedImageMeetsPrintDimensions(listingArtworkPixels.w, listingArtworkPixels.h, printAreaW, printAreaH)) {
      return `Expected ${printAreaW}×${printAreaH}px after crop; this file is ${listingArtworkPixels.w}×${listingArtworkPixels.h}px.`;
    }
    return null;
  })();
  const listingArtworkResolutionError =
    listingArtworkFileSizeError ?? listingArtworkMeasureError ?? printExportDimensionsError;
  const listingArtworkResolutionPending = Boolean(
    listingArtworkPreviewUrl && !listingArtworkPixels && !listingArtworkMeasureError,
  );

  const hasArtworkReady = useMemo(() => {
    if (artworkSurfaces.length === 0) {
      return listingSubmitArtworkFile != null;
    }
    return artworkSurfaces.every(
      (surface) => !surface.required || surfaceArtwork[surface.id] != null,
    );
  }, [artworkSurfaces, surfaceArtwork, listingSubmitArtworkFile]);

  const listingCanSubmit =
    Boolean(listingProductId) &&
    listingPriceMeetsMinimum &&
    listingRequestItemNameOk &&
    hasArtworkReady &&
    !listingArtworkResolutionError &&
    !listingArtworkResolutionPending &&
    !shopAtInReviewListingLimit;
  const artworkUploadInProgress = artworkUploadProgress != null;
  const artworkBusy = artworkSourcePreparing || artworkUploadInProgress || artworkBaking;
  const artworkUploadPercent =
    artworkUploadProgress && artworkUploadProgress.total > 0
      ? Math.round((artworkUploadProgress.current / artworkUploadProgress.total) * 100)
      : 0;
  const listingFormReady = listingCanSubmit;
  const listingSubmitSubmittedFlash =
    listingSavedFlash && !listingCanSubmit && !isListingPending;
  const listingBtnClass =
    isListingPending || artworkBusy
    ? btnPrimarySaving
    : !listingFormReady
      ? listingSavedFlash
        ? btnPrimarySaved
        : btnPrimaryDisabled
      : btnPrimary;
  const isListingFormSubmitDisabled = !listingFormReady || isListingPending || artworkBusy;
  const freezeListingRequestFields = isListingPending || artworkBusy;
  const listingRequestFieldsDisabled = freezeListingRequestFields || shopAtInReviewListingLimit;

  return (
    <div
      className={`space-y-4 text-sm text-zinc-300 ${embedded ? "" : "rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6"}`}
    >
      {draftListingRequestPrefill ? (
        <p className="rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-xs text-sky-200/90">
          Your draft listing is selected below — confirm prices and upload artwork to submit for review.
        </p>
      ) : null}

      <ListingCreditPackSection
        unpaidListings={unpaidPublicationFeeListings}
        freeListingSlots={freeListingSlots}
        stripePublishableKey={stripePublishableKey}
        mockListingFeeCheckout={mockListingFeeCheckout}
      />

      {catalogGroups.length === 0 ? (
        <p className="text-xs text-amber-200/80">
          <strong className="text-amber-100/90">No items to add yet.</strong>{" "}
          {listingPickerDiagnostics ? (
            listingPickerDiagnostics.adminCatalogItemCount === 0 ? (
              <>
                The allowed-items list under <strong className="font-medium text-amber-100/90">Admin → List</strong> has
                no rows yet — add items there first.
              </>
            ) : (
              <>
                Admin → List has rows but none could be loaded as choices — ensure each item has a valid minimum price.
              </>
            )
          ) : (
            <>
              The allowed-items list under <strong className="font-medium text-amber-100/90">Admin → List</strong> is
              empty or unavailable.
            </>
          )}{" "}
          Refresh this page after updating the list.
        </p>
      ) : !r2Configured ? (
        <p className="text-xs text-amber-200/80">
          R2 uploads are not configured — artwork upload is unavailable until the operator sets R2 keys.
        </p>
      ) : (
        <>
          {listingCreditConsentRequired ? (
            <p className="mt-2 text-xs text-zinc-500">
              Your next listing will use one listing credit. Buy more credits above if needed.
            </p>
          ) : null}
          {shopAtInReviewListingLimit ? (
            <p className="mt-2 rounded-lg border border-blue-900/45 bg-blue-950/25 px-3 py-2 text-xs text-blue-200/90">
              {shopInReviewListingRequestLimitError()}
            </p>
          ) : null}
          <form
            id={listingRequestFormId}
            className={`space-y-4${freezeListingRequestFields ? " pointer-events-none opacity-45" : ""}`}
            encType="multipart/form-data"
            inert={freezeListingRequestFields ? true : undefined}
            onSubmit={(e) => {
              e.preventDefault();
              if (!listingFormReady || isListingPending) return;
              const fd = new FormData();
              fd.set("productId", listingProductId);
              fd.set("listingPriceDollars", listingPrice);
              fd.set("requestItemName", listingRequestItemName.trim());
              fd.set("storefrontItemBlurb", listingStorefrontBlurb.trim());
              fd.set("listingSearchKeywords", keywordsJoined.trim());
              if (isPillowItem) {
                fd.set("pillowDoubleSided", pillowDoubleSidedEffective ? "1" : "0");
                fd.set("pillowSidesMode", pillowSidesMode);
              }
              if (duplicateFrontToBackOnSubmit || isMultiSurfaceArtwork) {
                const entries = buildListingArtworkBakedSubmitEntries({
                  surfaces: artworkSurfaces,
                  surfaceArtwork,
                  duplicateFrontToBackOnSubmit,
                });
                if (entries.length > 0) {
                  fd.set("listingArtworkBakedEntriesJson", JSON.stringify(entries));
                }
              } else if (activeSurfaceArtwork) {
                fd.set("listingArtworkBakedKey", activeSurfaceArtwork.requestImageKey);
                fd.set("listingArtworkBakedUrl", activeSurfaceArtwork.publicUrl);
              } else {
                const art = listingSubmitArtworkFile ?? listingFileRef.current?.files?.[0];
                if (art) fd.set("listingArtwork", art);
              }
              pendingListingFdRef.current = fd;
              setAttestationOpen(true);
            }}
          >
          <div>
            <p
              className={`text-xs font-medium text-zinc-400${shopAtInReviewListingLimit ? " opacity-45" : ""}`}
            >
              Item Catalogue
            </p>
            <p
              className={`mt-1 text-[11px] leading-relaxed text-zinc-600${shopAtInReviewListingLimit ? " opacity-45" : ""}`}
            >
              Select a base item your design will be printed on. Items are grouped by typical phone photo suitability.
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
              <div className="h-[350px] overflow-y-auto [scrollbar-gutter:stable]">
                <div className={CATALOG_PICKER_HEADER_ROW} aria-hidden>
                  <span className={`${CATALOG_PICKER_ITEM_HEADER_COL}${catalogPickerHeaderMutedClass(shopAtInReviewListingLimit)}`}>
                    Item
                  </span>
                  <div className={`${CATALOG_PICKER_TRAILING_COLS}${catalogPickerHeaderMutedClass(shopAtInReviewListingLimit)}`}>
                    <span className={CATALOG_PICKER_PHOTO_COL}>Item Photo</span>
                    <span className={CATALOG_PICKER_PRICE_COL}>Sale Price</span>
                  </div>
                </div>
                <ul
                  className="divide-y divide-zinc-800/80"
                  role="listbox"
                  aria-label="Items from admin catalog"
                  aria-disabled={shopAtInReviewListingLimit ? true : undefined}
                >
                {(
                  [
                    {
                      key: "phone_pic_safe",
                      title: CATALOG_ARTWORK_SOURCE_TIER_LABELS.phone_pic_safe,
                      groups: catalogGroupsByTier.phonePicSafe,
                    },
                    {
                      key: "camera_or_vector_only",
                      title: `${CATALOG_ARTWORK_SOURCE_TIER_LABELS.camera_or_vector_only} -- requires higher resolution images`,
                      groups: catalogGroupsByTier.cameraOrVectorOnly,
                    },
                  ] as const
                ).map((section) =>
                  section.groups.length === 0 ? null : (
                    <li key={section.key} className="list-none">
                      <div className={CATALOG_PICKER_SECTION_ROW} aria-hidden>
                        <span className={catalogPickerHeaderMutedClass(shopAtInReviewListingLimit)}>
                          {section.title}
                        </span>
                      </div>
                      <ul className="divide-y divide-zinc-800/80" role="group" aria-label={section.title}>
                        {section.groups.map((g) => {
                          const selected = listingProductId === g.option.productId;
                          const catalogPickDisabled = listingRequestFieldsDisabled;
                          return (
                            <li key={g.itemId}>
                              <div className={`${CATALOG_PICKER_ROW} relative z-0 px-3 py-2.5`}>
                                <label
                                  className={`${CATALOG_PICKER_ITEM_COL} flex items-center gap-2.5 text-sm text-zinc-200 ${catalogPickDisabled ? "cursor-not-allowed" : "cursor-pointer"}${shopAtInReviewListingLimit ? " opacity-45" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name="catalogProductPick"
                                    value={g.option.productId}
                                    checked={selected}
                                    disabled={catalogPickDisabled}
                                    onChange={() => setListingProductId(g.option.productId)}
                                    className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                                  />
                                  <span className="min-w-0 truncate">{g.itemName}</span>
                                </label>
                                <div className={CATALOG_PICKER_TRAILING_COLS}>
                                  {g.option.exampleHref ? (
                                    <CatalogItemPhotoLink href={g.option.exampleHref} />
                                  ) : (
                                    <span className={`${CATALOG_PICKER_PHOTO_COL} text-zinc-700`}>—</span>
                                  )}
                                  <span
                                    className={`${CATALOG_PICKER_PRICE_COL} text-xs text-zinc-500${shopAtInReviewListingLimit ? " opacity-45" : ""}`}
                                  >
                                    {formatUsdFromCents(g.option.minPriceCents)}
                                  </span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ),
                )}
              </ul>
              </div>
            </div>
            {selectedCatalogGroup ? (
              <div
                className={`mt-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-xs leading-relaxed text-zinc-400${shopAtInReviewListingLimit ? " opacity-45" : ""}`}
              >
                <p className="font-medium text-zinc-300">
                  {CATALOG_ARTWORK_SOURCE_TIER_LABELS[selectedCatalogGroup.option.artworkSourceTier]}
                </p>
                <p className="mt-1">
                  {CATALOG_ARTWORK_SOURCE_TIER_GUIDANCE[selectedCatalogGroup.option.artworkSourceTier]}
                </p>
                {selectedCatalogGroup.option.imageRequirementLabel ? (
                  <p className="mt-1.5 text-zinc-500">
                    <span className="text-zinc-600">Note: </span>
                    {selectedCatalogGroup.option.imageRequirementLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div
            className={shopAtInReviewListingLimit ? "pointer-events-none opacity-45" : undefined}
            aria-disabled={shopAtInReviewListingLimit ? true : undefined}
          >
          <label className="block text-xs text-zinc-500" htmlFor="listing-request-item-name">
            Name item
            <input
              id="listing-request-item-name"
              name="requestItemName"
              type="text"
              autoComplete="off"
              maxLength={120}
              value={listingRequestItemName}
              disabled={listingRequestFieldsDisabled}
              onChange={(e) => setListingRequestItemName(e.target.value)}
              onBlur={runRequestListingTextModerationBlur}
              onFocus={runRequestListingTextModerationBlur}
              placeholder="What you call this design or product"
              className="mt-1 block w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:cursor-not-allowed"
            />
            {listingItemNameModerationBlurError ? (
              <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                {listingItemNameModerationBlurError}
              </p>
            ) : null}
          </label>
          {selectedCatalogGroup ? (
            <div>
              <label
                className="block text-xs text-zinc-500"
                htmlFor={`listing-price-${selectedCatalogGroup.itemId}`}
              >
                Your list price (USD)
                <div className="mt-1 flex w-full min-w-0 max-w-md items-stretch rounded border border-zinc-700 bg-zinc-900">
                  <input
                    id={`listing-price-${selectedCatalogGroup.itemId}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={listingPrice}
                    disabled={listingRequestFieldsDisabled}
                    onChange={(e) => setListingPrice(e.target.value)}
                    onBlur={() => {
                      const minC = selectedCatalogGroup.option.minPriceCents;
                      const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
                      let cents = Number.isFinite(parsed) ? Math.round(parsed * 100) : minC;
                      if (cents < minC) cents = minC;
                      if (cents > SHOP_LISTING_MAX_PRICE_CENTS) cents = SHOP_LISTING_MAX_PRICE_CENTS;
                      setListingPrice((cents / 100).toFixed(2));
                    }}
                    className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm leading-snug text-zinc-100 outline-none focus:ring-0 disabled:cursor-not-allowed"
                  />
                  <ListingEstProfitBreakdownHelp
                    layout="field"
                    profitLabel={
                      listingProfitHint(
                        listingPrice,
                        selectedCatalogGroup.option.minPriceCents,
                        selectedCatalogGroup.option.goodsServicesCostCents,
                      ) ?? "Est. profit: —"
                    }
                    priceDollarsStr={listingPrice}
                    minPriceCents={selectedCatalogGroup.option.minPriceCents}
                    goodsServicesUnitCents={selectedCatalogGroup.option.goodsServicesCostCents}
                  />
                </div>
              </label>
              {listingPriceOverMax ? (
                <p className="mt-1.5 text-xs text-amber-200/90" role="status">
                  Maximum list price is {shopListingMaxPriceUsdLabel()} per item — lower the price to continue.
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                List prices cannot exceed {shopListingMaxPriceUsdLabel()} per option. Customers may add tips at checkout
                on eligible carts.
              </p>
            </div>
          ) : null}
          {isPillowItem ? (
            <ListingPillowDoubleSidedFields
              doubleSided={pillowDoubleSidedEffective}
              sidesMode={pillowSidesMode}
              adminDualSidedLocked={adminPillowDualSided}
              disabled={listingRequestFieldsDisabled}
              onDoubleSidedChange={handlePillowDoubleSidedChange}
              onSidesModeChange={handlePillowSidesModeChange}
            />
          ) : null}
          {isMultiSurfaceArtwork ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Print surfaces — upload artwork for each required side.</p>
              <ListingArtworkSurfaceTabs
                surfaces={artworkSurfaces}
                activeSurfaceId={activeSurfaceId}
                surfaceArtworkReady={surfaceArtworkReady}
                onSelect={selectArtworkSurface}
              />
            </div>
          ) : null}
          <label className="block text-xs text-zinc-500">
            {isMultiSurfaceArtwork && activeSurface
              ? `Artwork file — ${activeSurface.label} (PNG or JPEG — uploads capped at `
              : "Artwork file (PNG or JPEG — uploads capped at "}
            {artworkUploadV2 ? listingArtworkV2SourceMaxMb : listingArtworkUploadMaxMb} MB)
            <input
              ref={listingFileRef}
              type="file"
              name="listingArtwork"
              accept="image/jpeg,image/png,image/webp"
              disabled={listingRequestFieldsDisabled || !listingProductId}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) {
                  setListingSubmitArtworkFile(null);
                  setListingArtworkMeasureError(null);
                  setListingHasFile(false);
                  setListingArtworkPreviewUrl(null);
                  return;
                }
                const withinUploadCap = artworkUploadV2
                  ? listingArtworkV2SourceWithinCap(file.size, listingArtworkV2SourceMaxBytes)
                  : listingArtworkFileWithinUploadCap(file.size);
                if (!withinUploadCap) {
                  setListingSubmitArtworkFile(null);
                  setListingHasFile(false);
                  setListingArtworkPreviewUrl(null);
                  setListingArtworkMeasureError(
                    artworkUploadV2
                      ? listingArtworkV2SourceCapError(listingArtworkV2SourceMaxBytes)
                      : listingArtworkUploadCapError(),
                  );
                  if (listingFileRef.current) listingFileRef.current.value = "";
                  return;
                }
                void applyListingArtworkPickedFile(file);
              }}
              className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200 disabled:cursor-not-allowed"
            />
            {artworkBaking ? (
              <p className="mt-2 text-[11px] text-zinc-500" role="status">
                Preparing print file at {printAreaW}×{printAreaH}px…
              </p>
            ) : null}
            {artworkSourcePreparing ? (
              <p className="mt-2 text-[11px] text-zinc-500" role="status">
                Preparing image…
              </p>
            ) : null}
            {listingArtworkResolutionError && !listingArtworkPreviewUrl ? (
              <p className="mt-2 text-[11px] text-amber-200/90" role="alert">
                {listingArtworkResolutionError}
              </p>
            ) : null}
            {message ? (
              <p
                className={
                  message.tone === "ok"
                    ? "mt-2 rounded-lg border border-emerald-900/50 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-200/90"
                    : "mt-2 rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
                }
                role="status"
              >
                {message.text}
              </p>
            ) : null}
            {listingArtworkPreviewUrl ? (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">Preview</p>
                <div
                  className="inline-block max-w-full overflow-hidden rounded-lg border border-zinc-700"
                  style={artworkPreviewStyle}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob or same-origin baked preview */}
                  <img
                    src={listingArtworkPreviewUrl}
                    alt=""
                    className="max-h-40 max-w-full object-contain"
                    onError={() => {
                      const bakedKey = activeSurfaceArtwork?.requestImageKey;
                      if (!bakedKey || listingArtworkPreviewUrl.startsWith("/api/dashboard/listing-artwork/baked")) {
                        return;
                      }
                      replaceListingArtworkPreviewUrl(listingArtworkBakedPreviewApiUrl(bakedKey));
                    }}
                  />
                </div>
                {listingArtworkResolutionPending ? (
                  <p className="mt-1.5 text-[11px] text-zinc-500">Reading image size…</p>
                ) : null}
                {listingArtworkResolutionError ? (
                  <p className="mt-1.5 text-[11px] text-amber-200/90" role="alert">
                    {listingArtworkResolutionError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </label>

          <div className="space-y-4 border-t border-zinc-800 pt-4">
            <div className="space-y-1">
              <label htmlFor={storefrontPitchFieldId} className="block text-xs text-zinc-500">
                One Liner (Optional)
              </label>
              <textarea
                id={storefrontPitchFieldId}
                value={listingStorefrontBlurb}
                onChange={(e) => setListingStorefrontBlurb(e.target.value)}
                onBlur={runRequestListingTextModerationBlur}
                onFocus={runRequestListingTextModerationBlur}
                maxLength={STOREFRONT_ITEM_BLURB_MAX}
                rows={1}
                autoComplete="off"
                disabled={listingRequestFieldsDisabled}
                placeholder="Optional short line for your product page…"
                className="mt-1 block w-full min-w-0 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:cursor-not-allowed"
              />
              {listingBlurbModerationBlurError ? (
                <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                  {listingBlurbModerationBlurError}
                </p>
              ) : null}
              <p className="text-[11px] text-zinc-600">
                {listingStorefrontBlurb.length}/{STOREFRONT_ITEM_BLURB_MAX} characters
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor={listingKeywordsInputId} className="block text-xs text-zinc-500">
                Keywords (optional, helps shoppers find this listing)
              </label>
              <ListingSearchKeywordsChipInput
                inputId={listingKeywordsInputId}
                disabled={listingRequestFieldsDisabled}
                keywordTokens={keywordTokens}
                keywordDraft={keywordDraft}
                duplicateHint={keywordDuplicateHint}
                setKeywordTokens={setKeywordTokens}
                setKeywordDraft={setKeywordDraft}
                setDuplicateHint={setKeywordDuplicateHint}
                onGroupBlur={runRequestListingTextModerationBlur}
                onGroupFocus={runRequestListingTextModerationBlur}
              />
              {listingKeywordsModerationBlurError ? (
                <p className="mt-1 text-xs leading-snug text-red-300/90" role="alert">
                  {listingKeywordsModerationBlurError}
                </p>
              ) : null}
            </div>
          </div>
          </div>
          </form>
          {artworkUploadProgress ? (
            <div className="mt-3 space-y-1.5" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Uploading artwork…</span>
                <span className="tabular-nums">
                  {artworkUploadV2
                    ? `${artworkUploadPercent}%`
                    : `${artworkUploadProgress.current}/${artworkUploadProgress.total} parts (${artworkUploadPercent}%)`}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-zinc-800"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-zinc-300 transition-[width] duration-200 ease-out"
                  style={{ width: `${artworkUploadPercent}%` }}
                />
              </div>
            </div>
          ) : null}
          <button
            type="submit"
            form={listingRequestFormId}
            disabled={isListingFormSubmitDisabled}
            className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 ${listingBtnClass}`}
            aria-busy={isListingPending || artworkUploadInProgress}
          >
            {artworkSourcePreparing ? (
              <p className="mt-3 text-[11px] text-zinc-500" role="status">
                Preparing artwork…
              </p>
            ) : null}
            {artworkSourcePreparing ? (
              <>
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-500/80 border-t-zinc-950"
                  aria-hidden
                />
                <span>Preparing artwork…</span>
              </>
            ) : artworkUploadProgress ? (
              <>
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-500/80 border-t-zinc-950"
                  aria-hidden
                />
                <span>
                  Uploading artwork ({artworkUploadProgress.current}/{artworkUploadProgress.total})…
                </span>
              </>
            ) : isListingPending ? (
              <>
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-500/80 border-t-zinc-950"
                  aria-hidden
                />
                <span>Submitting…</span>
              </>
            ) : listingSubmitSubmittedFlash ? (
              <>
                <svg
                  className="size-4 shrink-0 text-emerald-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.848-9.817a.75.75 0 011.051-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Submitted</span>
              </>
            ) : (
              <span>
                Submit for review
              </span>
            )}
          </button>
        </>
      )}

      {attestationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-attestation-title"
        >
          <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl">
            <h3 id="listing-attestation-title" className="text-base font-semibold text-zinc-100">
              Confirm listing request
            </h3>
            <label className="mt-4 flex cursor-pointer gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={attestationChecked}
                onChange={(e) => setAttestationChecked(e.target.checked)}
                className="mt-1 shrink-0 rounded border-zinc-600"
              />
              <span>
                I have the rights to the photo / artwork I am uploading, and it follows the{" "}
                <Link
                  href="/shop-regulations"
                  className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGuidelinesOpen(true);
                  }}
                >
                  shop regulations
                </Link>
                .
              </span>
            </label>
            {listingCreditConsentRequired ? (
              <label className="mt-3 flex cursor-pointer gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={feeChargeConsentChecked}
                  onChange={(e) => setFeeChargeConsentChecked(e.target.checked)}
                  className="mt-1 shrink-0 rounded border-zinc-600"
                />
                <span>This listing will use one listing credit from my balance.</span>
              </label>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={() => {
                  setAttestationOpen(false);
                  pendingListingFdRef.current = null;
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!attestationChecked || !feeConsentOk || isListingPending || artworkUploadInProgress}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  const fd = pendingListingFdRef.current;
                  if (!fd || !attestationChecked || !feeConsentOk) return;
                  fd.set("guidelinesAttestation", "1");
                  if (listingCreditConsentRequired) {
                    fd.set("feeChargeAttestation", "1");
                  }
                  setAttestationOpen(false);
                  pendingListingFdRef.current = null;
                  void handleListingSubmit(fd);
                }}
              >
                {artworkBaking
                  ? "Preparing print file…"
                  : artworkUploadProgress
                    ? artworkUploadV2
                      ? `Uploading artwork (${artworkUploadPercent}%)…`
                      : `Uploading artwork (${artworkUploadProgress.current}/${artworkUploadProgress.total})…`
                    : isListingPending
                      ? "Submitting…"
                      : "Submit for review"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {composeDialogOpen && composeImageUrl && printAreaW != null && printAreaH != null && listingSourceKey ? (
        <ListingArtworkComposeDialog
          open={composeDialogOpen}
          imageUrl={composeImageUrl}
          printWidthPx={printAreaW}
          printHeightPx={printAreaH}
          minArtworkDpi={minArtworkDpi}
          artworkLetterboxFill={artworkLetterboxFill ?? ListingArtworkLetterboxFill.transparent}
          isCanvasPrintItem={isCanvasPrintItem}
          showBlackMugBackgroundTip={showBlackMugBackgroundTip}
          showWhiteMugBackgroundTip={showWhiteMugBackgroundTip}
          showRoundedCornerCropGuide={showRoundedCornerCropGuide}
          catalogItemName={selectedCatalogGroup?.itemName}
          categoryTagSlug={selectedCatalogGroup?.categoryTag?.slug}
          canvasPresentation={canvasPresentation}
          surfaceLabel={surfaceLabelForDialog}
          onClose={() => {
            setComposeDialogOpen(false);
            setComposeImageUrl(null);
            const sk = listingSourceKey;
            setListingSourceKey(null);
            if (sk) void abandonUnconfirmedListingRequestSubmit(null, null, sk);
            if (listingFileRef.current) listingFileRef.current.value = "";
          }}
          onComplete={(result) => {
            void (async () => {
              setComposeDialogOpen(false);
              if (!listingProductId || !listingSourceKey) {
                setListingArtworkMeasureError("Select a catalog item before preparing artwork.");
                return;
              }
              setArtworkBaking(true);
              const sourceKey = listingSourceKey;
              const surfaceId = activeSurfaceIdRef.current;
              const previousBakedKey = surfaceArtworkRef.current[surfaceId]?.requestImageKey ?? null;
              try {
                const baked = await bakeListingArtworkV2Client({
                  sourceKey,
                  transform: result.transform,
                  productId: listingProductId,
                });
                if (!baked.ok) {
                  setListingArtworkMeasureError(baked.error);
                  setListingHasFile(false);
                  setSurfaceArtworkForId(surfaceId, null);
                  return;
                }

                if (previousBakedKey && previousBakedKey !== baked.requestImageKey) {
                  void abandonUnconfirmedListingRequestSubmit(null, previousBakedKey);
                }

                setListingSourceKey(null);
                setComposeImageUrl(null);
                setListingSubmitArtworkFile(null);
                setSurfaceArtworkForId(surfaceId, {
                  requestImageKey: baked.requestImageKey,
                  publicUrl: baked.publicUrl,
                });
                setListingHasFile(true);
                replaceListingArtworkPreviewUrl(
                  result.previewUrl ?? listingArtworkBakedPreviewApiUrl(baked.requestImageKey),
                );
              } finally {
                setArtworkBaking(false);
              }
              if (listingFileRef.current) listingFileRef.current.value = "";
            })();
          }}
        />
      ) : null}

      {cropDialogOpen && cropSourceObjectUrl && cropSourceFile && printAreaW != null && printAreaH != null ? (
        <ListingArtworkCropDialog
          open={cropDialogOpen}
          imageUrl={cropSourceObjectUrl}
          sourceFile={cropSourceFile}
          printWidthPx={printAreaW}
          printHeightPx={printAreaH}
          minArtworkDpi={minArtworkDpi}
          artworkLetterboxFill={artworkLetterboxFill ?? ListingArtworkLetterboxFill.transparent}
          isCanvasPrintItem={isCanvasPrintItem}
          showBlackMugBackgroundTip={showBlackMugBackgroundTip}
          showWhiteMugBackgroundTip={showWhiteMugBackgroundTip}
          showRoundedCornerCropGuide={showRoundedCornerCropGuide}
          catalogItemName={selectedCatalogGroup?.itemName}
          categoryTagSlug={selectedCatalogGroup?.categoryTag?.slug}
          canvasPresentation={canvasPresentation}
          surfaceLabel={surfaceLabelForDialog}
          onClose={() => {
            setCropDialogOpen(false);
            setCropSourceFile(null);
            setCropSourceObjectUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            if (listingFileRef.current) listingFileRef.current.value = "";
          }}
          onComplete={(result) => {
            void (async () => {
              setCropDialogOpen(false);
              if (result.mode === "file") {
                setCropSourceFile(null);
                setCropSourceObjectUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
                setSurfaceArtworkForId(activeSurfaceIdRef.current, null);
                setListingSubmitArtworkFile(result.file);
                setListingHasFile(true);
                replaceListingArtworkPreviewUrl(URL.createObjectURL(result.file));
              } else {
                if (!listingProductId) {
                  setListingArtworkMeasureError("Select a catalog item before uploading artwork.");
                  return;
                }
                setArtworkSourcePreparing(true);
                const sourceUrl = cropSourceObjectUrl;
                const surfaceId = activeSurfaceIdRef.current;
                const previousBakedKey = surfaceArtworkRef.current[surfaceId]?.requestImageKey ?? null;
                try {
                  const compressed = await compressListingArtworkSourceForStagingUpload(result.sourceFile, {
                    crop: result.crop.pixelCrop,
                    printWidthPx: result.crop.printWidthPx,
                    printHeightPx: result.crop.printHeightPx,
                    minArtworkDpi: minArtworkDpi,
                  });
                  if (!compressed.ok) {
                    setListingArtworkMeasureError(compressed.error);
                    setListingHasFile(false);
                    setSurfaceArtworkForId(surfaceId, null);
                    return;
                  }
                  const stagingFile = compressed.file;
                  if (!listingArtworkFileWithinUploadCap(stagingFile.size)) {
                    setListingArtworkMeasureError(listingArtworkUploadCapError());
                    setListingHasFile(false);
                    setSurfaceArtworkForId(surfaceId, null);
                    return;
                  }

                  const upload = await uploadListingArtworkFileToStaging(stagingFile, (current, total) => {
                    setArtworkUploadProgress({ current, total });
                  });
                  if (!upload.ok) {
                    setListingArtworkMeasureError(upload.error);
                    setListingHasFile(false);
                    setSurfaceArtworkForId(surfaceId, null);
                    return;
                  }

                  setArtworkUploadProgress(null);
                  setArtworkBaking(true);
                  const baked = await bakeListingArtworkFromStagingClient({
                    stagingKey: upload.stagingKey,
                    crop: result.crop,
                    productId: listingProductId,
                  });
                  if (!baked.ok) {
                    setListingArtworkMeasureError(baked.error);
                    setListingHasFile(false);
                    setSurfaceArtworkForId(surfaceId, null);
                    void abandonUnconfirmedListingRequestSubmit(upload.stagingKey);
                    return;
                  }

                  if (previousBakedKey && previousBakedKey !== baked.requestImageKey) {
                    void abandonUnconfirmedListingRequestSubmit(null, previousBakedKey);
                  }

                  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
                  setCropSourceObjectUrl(null);
                  setCropSourceFile(null);
                  setListingSubmitArtworkFile(null);
                  setSurfaceArtworkForId(surfaceId, {
                    requestImageKey: baked.requestImageKey,
                    publicUrl: baked.publicUrl,
                  });
                  setListingHasFile(true);
                  replaceListingArtworkPreviewUrl(
                    listingArtworkBakedPreviewApiUrl(baked.requestImageKey),
                  );
                } finally {
                  setArtworkUploadProgress(null);
                  setArtworkSourcePreparing(false);
                  setArtworkBaking(false);
                }
              }
              if (listingFileRef.current) listingFileRef.current.value = "";
            })();
          }}
        />
      ) : null}

      <ItemGuidelinesPopup open={guidelinesOpen} onClose={() => setGuidelinesOpen(false)} />
    </div>
  );
}
