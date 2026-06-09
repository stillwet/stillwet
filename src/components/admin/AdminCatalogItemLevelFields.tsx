"use client";

export function AdminCatalogItemLevelFields({
  exampleListingUrl,
  minPriceDollars,
  goodsServicesCostDollars,
  storefrontDescription,
  onChangeExampleListingUrl,
  onChangeMinPriceDollars,
  onChangeGoodsServicesCostDollars,
  onChangeStorefrontDescription,
}: {
  exampleListingUrl: string;
  minPriceDollars: string;
  goodsServicesCostDollars: string;
  storefrontDescription: string;
  onChangeExampleListingUrl: (v: string) => void;
  onChangeMinPriceDollars: (v: string) => void;
  onChangeGoodsServicesCostDollars: (v: string) => void;
  onChangeStorefrontDescription: (v: string) => void;
}) {
  const previewUrl = exampleListingUrl.trim();

  return (
    <div className="space-y-3 rounded border border-zinc-800/80 bg-zinc-950/40 p-3">
      <label className="block min-w-0 text-[11px] text-zinc-500">
        Storefront description (optional)
        <textarea
          value={storefrontDescription}
          onChange={(e) => onChangeStorefrontDescription(e.target.value)}
          rows={4}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
          placeholder="Only this admin text is shown on the public product page for linked listings. Printify product descriptions are not used."
        />
      </label>
      <div className="space-y-2">
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
      <label className="block max-w-[10rem] text-[11px] text-zinc-500">
        Min price (USD)
        <input
          type="text"
          inputMode="decimal"
          value={minPriceDollars}
          onChange={(e) => onChangeMinPriceDollars(e.target.value)}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
          placeholder="0.00"
        />
      </label>
      <label className="block max-w-[10rem] text-[11px] text-zinc-500">
        Goods/services cost (USD, optional)
        <input
          type="text"
          inputMode="decimal"
          value={goodsServicesCostDollars}
          onChange={(e) => onChangeGoodsServicesCostDollars(e.target.value)}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
          placeholder="0.00"
        />
      </label>
    </div>
  );
}
