import Link from "next/link";

export function GiftCreatorStorefrontLink() {
  return (
    <div className="mx-auto flex max-w-[1124px] justify-end px-4 pt-3 sm:px-6">
      <Link
        href="/gift-creator"
        className="store-nav-link text-zinc-500 transition hover:text-zinc-200"
      >
        Gift a creator
      </Link>
    </div>
  );
}
