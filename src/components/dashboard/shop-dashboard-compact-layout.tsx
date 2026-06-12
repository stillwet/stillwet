"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ShopDashboardCompactLayoutContextValue = {
  compact: boolean;
  setCompact: (compact: boolean) => void;
};

const ShopDashboardCompactLayoutContext =
  createContext<ShopDashboardCompactLayoutContextValue | null>(null);

export function ShopDashboardCompactLayoutProvider({ children }: { children: ReactNode }) {
  const [compact, setCompactState] = useState(false);
  const setCompact = useCallback((next: boolean) => {
    setCompactState((prev) => (prev === next ? prev : next));
  }, []);
  const value = useMemo(() => ({ compact, setCompact }), [compact, setCompact]);
  return (
    <ShopDashboardCompactLayoutContext.Provider value={value}>
      {children}
    </ShopDashboardCompactLayoutContext.Provider>
  );
}

export function useShopDashboardCompactLayout() {
  return useContext(ShopDashboardCompactLayoutContext)?.compact ?? false;
}

export function useSetShopDashboardCompactLayout() {
  return useContext(ShopDashboardCompactLayoutContext)?.setCompact ?? (() => {});
}
