import { redirect } from "next/navigation";

/** `/shop` → full catalog (same as home “All products”). */
export default function ShopRootRedirect() {
  redirect("/shop/all");
}
