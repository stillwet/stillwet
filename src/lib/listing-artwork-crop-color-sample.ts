/** Sample a hex color from the crop preview image at a viewport click point. */
export function rgbBytesToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function listingArtworkCropPreviewSupportsEyeDropper(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

export async function openListingArtworkCropEyeDropper(): Promise<string | null> {
  if (!listingArtworkCropPreviewSupportsEyeDropper()) return null;
  type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
  const EyeDropper = (window as Window & { EyeDropper?: EyeDropperCtor }).EyeDropper;
  if (!EyeDropper) return null;
  try {
    const result = await new EyeDropper().open();
    const hex = result.sRGBHex?.trim().toLowerCase();
    return hex && /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
  } catch {
    return null;
  }
}

/**
 * Map a click on the crop preview to a source pixel (approximate when the image is zoomed/rotated).
 */
export async function sampleColorFromCropPreviewClick(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): Promise<string | null> {
  const img = container.querySelector<HTMLImageElement>(".reactEasyCrop_Image");
  if (!img || !img.complete || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) {
    return null;
  }

  const rect = img.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  if (localX < 0 || localY < 0 || localX >= rect.width || localY >= rect.height) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0);
  } catch {
    return null;
  }

  const u = localX / rect.width;
  const v = localY / rect.height;
  const px = Math.min(img.naturalWidth - 1, Math.max(0, Math.floor(u * img.naturalWidth)));
  const py = Math.min(img.naturalHeight - 1, Math.max(0, Math.floor(v * img.naturalHeight)));
  const data = ctx.getImageData(px, py, 1, 1).data;
  return rgbBytesToHex(data[0]!, data[1]!, data[2]!);
}
