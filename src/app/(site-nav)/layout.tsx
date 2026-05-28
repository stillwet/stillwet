/**
 * Match `/dashboard` — without this, Vercel can cut the RSC at ~10s while the client stays on
 * `app/loading.tsx` (looks like an infinite load). Child layouts run `SiteHeader` (Prisma + session).
 */
export const maxDuration = 300;

/** Platform marketing + browse pages: header in `(marketing)` / `(browse)` route groups. */
export default function SiteNavLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
