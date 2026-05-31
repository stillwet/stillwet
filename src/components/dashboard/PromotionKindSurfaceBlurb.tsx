import Link from "next/link";
import { PromotionKind } from "@/generated/prisma/enums";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import { HOT_ITEM_PLATFORM_PERIOD_CAP, TOP_SHOP_PLATFORM_PERIOD_CAP } from "@/lib/promotion-policy-shared";
import {
  PROMOTION_SURFACE_ALL_ITEMS_HREF,
  PROMOTION_SURFACE_POPULAR_FILTER_HREF,
  PROMOTION_SURFACE_SHOPS_HREF,
} from "@/lib/promotion-surface-paths";

const surfaceLinkClass =
  "text-violet-400/90 underline underline-offset-2 hover:text-violet-300";

/** Static placement summary with links to live storefront surfaces (server HTML). */
export function PromotionKindSurfaceBlurb(props: { kind: PlacementCheckoutPromotionKind }) {
  const { kind } = props;

  switch (kind) {
    case PromotionKind.MOST_POPULAR_OF_TAG_ITEM:
      return (
        <>
          <p>
            Displays first under the{" "}
            <Link
              href={PROMOTION_SURFACE_POPULAR_FILTER_HREF}
              prefetch={false}
              className={surfaceLinkClass}
            >
              Popular
            </Link>{" "}
            filter on the{" "}
            <Link href={PROMOTION_SURFACE_ALL_ITEMS_HREF} prefetch={false} className={surfaceLinkClass}>
              all items
            </Link>{" "}
            page.
          </p>
          <p className="text-zinc-600">
            1st paid, top of list. That&apos;s the benefit of buying for the upcoming promotion period.
          </p>
        </>
      );
    case PromotionKind.HOT_FEATURED_ITEM:
      return (
        <>
          <p>
            Displays as a &quot;Hot Item&quot; on the{" "}
            <Link href={PROMOTION_SURFACE_ALL_ITEMS_HREF} prefetch={false} className={surfaceLinkClass}>
              all items
            </Link>{" "}
            page carousel.
          </p>
          <p className="text-zinc-600">
            Each placement period allows for {HOT_ITEM_PLATFORM_PERIOD_CAP} promotions. Get yours before we run out!
          </p>
        </>
      );
    case PromotionKind.FEATURED_SHOP_HOME:
      return (
        <>
          <p>
            Displays as a &quot;Featured Shop&quot; on the{" "}
            <Link href={PROMOTION_SURFACE_SHOPS_HREF} prefetch={false} className={surfaceLinkClass}>
              all shops
            </Link>{" "}
            page.
          </p>
          <p className="text-zinc-600">
            Each placement period allows for {TOP_SHOP_PLATFORM_PERIOD_CAP} promotions. Get yours before we run out!
          </p>
        </>
      );
    default:
      return null;
  }
}
