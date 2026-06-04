"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  navTabCountBadgeClass,
  navTabCountBadgeMutedClass,
} from "@/lib/nav-tab-count-badge";
import type { AdminMainNavBadgeCounts } from "@/lib/admin-nav-badges";
import { fetchAdminMainShellData } from "@/actions/admin-nav-badges-actions";

type AdminMainShellState = AdminMainNavBadgeCounts & { hasProducts: boolean };

const AdminMainShellContext = createContext<AdminMainShellState | null>(null);

export function AdminMainShellProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<AdminMainShellState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminMainShellData().then(
      (data) => {
        if (!cancelled) setState(data);
      },
      (err) => {
        if (!cancelled) console.error("[AdminMainShell] fetch failed", err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminMainShellContext.Provider value={state}>
      {props.children}
    </AdminMainShellContext.Provider>
  );
}

export function AdminMainEmptyDbBanner() {
  const state = useContext(AdminMainShellContext);
  if (state == null || state.hasProducts) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-900/45 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90"
    >
      <p className="font-medium text-amber-50/95">
        Database loaded OK — no products in this database
      </p>
      <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
        Admin connected to Postgres successfully. There are no product rows yet — this is an empty
        catalog, not a load error. If you expected data, this deployment may be pointed at a
        different database than where you created it (for example local vs Vercel).
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-amber-200/80">
        <li>
          Confirm{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            POSTGRES_PRISMA_URL
          </code>{" "}
          or{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            DATABASE_URL
          </code>{" "}
          in this deployment (e.g. Vercel → Production) points at the database you intend.
        </li>
        <li>
          Run{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            npx prisma migrate deploy
          </code>{" "}
          and{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            npm run db:seed
          </code>{" "}
          from your machine using that same URL (see VERCEL.md).
        </li>
        <li>
          Or add listings in Admin Dash / Backend admin (and sync Printify if you use it)—they are
          stored only in the database your env points to.
        </li>
      </ul>
    </div>
  );
}

function badgeClass(variant: "pill" | "muted", count: number): string {
  return variant === "pill" ? navTabCountBadgeClass(count) : navTabCountBadgeMutedClass(count);
}

export function AdminMainNavCount(props: {
  field: keyof AdminMainNavBadgeCounts;
  variant?: "pill" | "muted";
}) {
  const state = useContext(AdminMainShellContext);
  const variant = props.variant ?? "pill";
  const count = state?.[props.field];
  if (count == null) {
    return <span className={badgeClass(variant, 0)}>(…)</span>;
  }
  return <span className={badgeClass(variant, count)}>({count})</span>;
}

export function AdminShellCountsProvider(props: {
  adminSection: "main" | "backend";
  children: ReactNode;
}) {
  if (props.adminSection === "main") {
    return <AdminMainShellProvider>{props.children}</AdminMainShellProvider>;
  }
  return props.children;
}
