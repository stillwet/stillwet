import {
  listingArtworkV2SourceCapError,
  listingArtworkV2SourceWithinCap,
} from "@/lib/listing-artwork-v2/limits";

export type ListingArtworkV2UploadInitResult =
  | {
      ok: true;
      sourceKey: string;
      presignedPutUrl: string;
      expiresAt: string;
    }
  | { ok: false; error: string };

export async function initListingArtworkSourceUpload(
  contentType: string,
  byteSize: number,
): Promise<ListingArtworkV2UploadInitResult> {
  let res: Response;
  try {
    res = await fetch("/api/dashboard/listing-artwork/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, byteSize }),
    });
  } catch {
    return { ok: false, error: "Could not start upload (network). Check your connection and try again." };
  }

  let payload: {
    ok?: boolean;
    error?: string;
    sourceKey?: string;
    presignedPutUrl?: string;
    expiresAt?: string;
  };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: `Could not start upload (${res.status}). Try again.` };
  }

  if (!res.ok || !payload.ok) {
    return {
      ok: false,
      error: payload.error?.trim() || `Could not start upload (${res.status}). Try again.`,
    };
  }

  const sourceKey = String(payload.sourceKey ?? "").trim();
  const presignedPutUrl = String(payload.presignedPutUrl ?? "").trim();
  const expiresAt = String(payload.expiresAt ?? "").trim();
  if (!sourceKey || !presignedPutUrl) {
    return { ok: false, error: "Upload could not be prepared. Try again." };
  }

  return { ok: true, sourceKey, presignedPutUrl, expiresAt };
}

export async function putFileToPresignedR2Url(
  presignedPutUrl: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!listingArtworkV2SourceWithinCap(file.size)) {
    return { ok: false, error: listingArtworkV2SourceCapError() };
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presignedPutUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress?.(ev.loaded, ev.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
        return;
      }
      resolve({
        ok: false,
        error: `Upload failed (${xhr.status}). Try again.`,
      });
    };
    xhr.onerror = () => {
      resolve({ ok: false, error: "Upload failed (network). Check your connection and try again." });
    };
    xhr.send(file);
  });
}

export type ListingArtworkV2UploadCompleteResult =
  | {
      ok: true;
      sourceKey: string;
      previewGetUrl: string;
      width: number;
      height: number;
    }
  | { ok: false; error: string };

export async function completeListingArtworkSourceUpload(
  sourceKey: string,
): Promise<ListingArtworkV2UploadCompleteResult> {
  let res: Response;
  try {
    res = await fetch("/api/dashboard/listing-artwork/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceKey }),
    });
  } catch {
    return { ok: false, error: "Could not verify upload (network). Try again." };
  }

  let payload: {
    ok?: boolean;
    error?: string;
    sourceKey?: string;
    previewGetUrl?: string;
    width?: number;
    height?: number;
  };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: `Could not verify upload (${res.status}). Try again.` };
  }

  if (!res.ok || !payload.ok) {
    return {
      ok: false,
      error: payload.error?.trim() || `Could not verify upload (${res.status}). Try again.`,
    };
  }

  const width = Number(payload.width);
  const height = Number(payload.height);
  const previewGetUrl = String(payload.previewGetUrl ?? "").trim();
  const key = String(payload.sourceKey ?? sourceKey).trim();
  if (!previewGetUrl || !key || !(width > 0) || !(height > 0)) {
    return { ok: false, error: "Upload verification failed. Try uploading again." };
  }

  return { ok: true, sourceKey: key, previewGetUrl, width, height };
}

export async function uploadListingArtworkSourceToR2(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<
  | { ok: true; sourceKey: string; previewGetUrl: string; width: number; height: number }
  | { ok: false; error: string }
> {
  const init = await initListingArtworkSourceUpload(file.type, file.size);
  if (!init.ok) return init;

  const put = await putFileToPresignedR2Url(init.presignedPutUrl, file, onProgress);
  if (!put.ok) return put;

  const complete = await completeListingArtworkSourceUpload(init.sourceKey);
  if (!complete.ok) return complete;

  return {
    ok: true,
    sourceKey: complete.sourceKey,
    previewGetUrl: complete.previewGetUrl,
    width: complete.width,
    height: complete.height,
  };
}
