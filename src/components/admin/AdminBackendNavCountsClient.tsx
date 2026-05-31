"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { navTabCountBadgeClass } from "@/lib/nav-tab-count-badge";
import type { AdminBackendNavCounts } from "@/lib/admin-backend-nav-badges";
import { fetchAdminBackendNavCounts } from "@/actions/admin-nav-badges-actions";

const AdminBackendNavCountsContext = createContext<AdminBackendNavCounts | null>(null);

export function AdminBackendNavCountsProvider(props: { children: ReactNode }) {
  const [counts, setCounts] = useState<AdminBackendNavCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminBackendNavCounts().then(
      (data) => {
        if (!cancelled) setCounts(data);
      },
      (err) => {
        if (!cancelled) console.error("[AdminBackendNavCounts] fetch failed", err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminBackendNavCountsContext.Provider value={counts}>
      {props.children}
    </AdminBackendNavCountsContext.Provider>
  );
}

export function AdminBackendNavCount(props: { field: keyof AdminBackendNavCounts }) {
  const counts = useContext(AdminBackendNavCountsContext);
  const count = counts?.[props.field];
  if (count == null) {
    return <span className={navTabCountBadgeClass(0)}>(…)</span>;
  }
  return <span className={navTabCountBadgeClass(count)}>({count})</span>;
}
