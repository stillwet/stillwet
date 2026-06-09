"use client";

export function AdminCatalogItemReferencePhotoFields({
  exampleListingUrl,
  onChangeExampleListingUrl,
}: {
  exampleListingUrl: string;
  onChangeExampleListingUrl: (v: string) => void;
}) {
  const previewUrl = exampleListingUrl.trim();

  return (
    <div className="space-y-2 rounded border border-zinc-800/80 bg-zinc-950/40 p-3">
      <p className="text-[11px] font-medium text-zinc-400">Item reference photo</p>
      <p className="text-[10px] leading-snug text-zinc-600">
        Example listing photo for the shop listing-request catalog &ldquo;Photo&rdquo; link only.
      </p>
      {previewUrl ? (
        <div className="mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className="h-24 w-24 rounded border border-zinc-700 object-cover"
          />
        </div>
      ) : null}
      <label className="block min-w-0 text-[11px] text-zinc-500">
        Image URL (optional — paste or upload below when editing)
        <input
          type="url"
          value={exampleListingUrl}
          onChange={(e) => onChangeExampleListingUrl(e.target.value)}
          maxLength={2048}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200"
          placeholder="https://…/item-reference.webp"
        />
      </label>
    </div>
  );
}
