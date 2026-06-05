import type { ListingArtworkCropPayload } from "@/lib/listing-artwork-crop-payload";

export type ListingArtworkBakeClientResult =
  | {
      ok: true;
      requestImageKey: string;
      publicUrl: string;
      contentType: string;
      width?: number;
      height?: number;
    }
  | { ok: false; error: string };

export async function bakeListingArtworkFromStagingClient(params: {
  stagingKey: string;
  crop: ListingArtworkCropPayload;
  productId: string;
}): Promise<ListingArtworkBakeClientResult> {
  let res: Response;
  try {
    res = await fetch("/api/dashboard/listing-artwork/bake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stagingKey: params.stagingKey,
        crop: params.crop,
        productId: params.productId,
      }),
    });
  } catch {
    return {
      ok: false,
      error: "Could not prepare print file (network). Check your connection and try again.",
    };
  }

  let payload: {
    ok?: boolean;
    error?: string;
    requestImageKey?: string;
    publicUrl?: string;
    contentType?: string;
    width?: number;
    height?: number;
  };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return {
      ok: false,
      error: `Could not prepare print file (${res.status}). Try again.`,
    };
  }

  if (!res.ok || !payload.ok) {
    return {
      ok: false,
      error: payload.error?.trim() || `Could not prepare print file (${res.status}). Try again.`,
    };
  }

  const requestImageKey = String(payload.requestImageKey ?? "").trim();
  const publicUrl = String(payload.publicUrl ?? "").trim();
  const contentType = String(payload.contentType ?? "").trim();
  if (!requestImageKey || !publicUrl) {
    return { ok: false, error: "Could not prepare print file. Try cropping again." };
  }

  const width = Number(payload.width);
  const height = Number(payload.height);

  return {
    ok: true,
    requestImageKey,
    publicUrl,
    contentType: contentType || "image/jpeg",
    ...(width > 0 && height > 0 ? { width, height } : {}),
  };
}
