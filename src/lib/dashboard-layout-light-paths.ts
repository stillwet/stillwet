/** Dashboard child routes that must not run optional shop Prisma reads in the section layout. */
const DASHBOARD_LAYOUT_LIGHT_PREFIXES = [
  "/dashboard/login",
  "/dashboard/forgot-password",
  "/dashboard/reset-password",
  "/dashboard/verify-email",
  "/dashboard/preview-reset-email",
  "/dashboard/preview-verify-email",
  "/dashboard/confirm-device",
  "/dashboard/account-deletion/confirm",
  "/account-deletion/confirm",
] as const;

export function isDashboardLayoutLightPath(pathname: string): boolean {
  return DASHBOARD_LAYOUT_LIGHT_PREFIXES.some((p) => pathname.startsWith(p));
}
