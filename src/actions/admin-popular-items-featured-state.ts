/** Client + `useActionState` — must not live in a `"use server"` file (Next only allows async fn exports there). */
export type AdminSavePopularItemsFeaturedState = { ok: boolean; error: string | null };

export const adminSavePopularItemsFeaturedInitialState: AdminSavePopularItemsFeaturedState = {
  ok: false,
  error: null,
};
