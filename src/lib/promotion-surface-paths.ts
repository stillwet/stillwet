import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { shopAllBrowseQueryString } from "@/lib/shop-all-browse-query";

/** Marketplace all-items browse (`/shop/all`). */
export const PROMOTION_SURFACE_ALL_ITEMS_HREF = SHOP_ALL_ROUTE;

/** All items with Popular sort — where Popular item promotions surface. */
export const PROMOTION_SURFACE_POPULAR_FILTER_HREF = `${SHOP_ALL_ROUTE}${shopAllBrowseQueryString({ sort: "popular" })}`;

export const PROMOTION_SURFACE_HOME_HREF = "/";

export const PROMOTION_SURFACE_SHOPS_HREF = "/shops";
