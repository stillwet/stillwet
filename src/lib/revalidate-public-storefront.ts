import { revalidateTag } from "next/cache";
import { PUBLIC_STOREFRONT_CACHE_TAG } from "@/lib/public-storefront-cache";

export function revalidatePublicStorefront(): void {
  revalidateTag(PUBLIC_STOREFRONT_CACHE_TAG, { expire: 0 });
}
