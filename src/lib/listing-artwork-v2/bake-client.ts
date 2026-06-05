import type { ListingArtworkTransformV2 } from "@/lib/listing-artwork-v2/transform";

export type ListingArtworkV2BakeClientResult =
  | {
      ok: true;
      requestImageKey: string;
      publicUrl: string;
      contentType: string;
      width: number;
      height: number;
    }
  | { ok: false; error: string };

export async function bakeListingArtworkV2Client(params: {
  sourceKey: string;
  transform: ListingArtworkTransformV2;
  productId: string;
}): Promise<ListingArtworkV2BakeClientResult> {
  let res: Response;
  try {
    res = await fetch("/api/dashboard/listing-artwork/bake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceKey: params.sourceKey,
        transform: params.transform,
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
  const contentType = String(payload.contentType ?? "").trim() || "image/jpeg";
  const width = Number(payload.width);
  const height = Number(payload.height);
  if (!requestImageKey || !publicUrl || !(width > 0) || !(height > 0)) {
    return { ok: false, error: "Could not prepare print file. Try cropping again." };
  }

  return {
    ok: true,
    requestImageKey,
    publicUrl,
    contentType,
    width,
    height,
  };
}
