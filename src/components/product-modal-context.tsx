"use client";

import { createContext, useContext, type ReactNode } from "react";

const ProductModalContext = createContext<(() => void) | null>(null);

export function ProductModalProvider({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return <ProductModalContext.Provider value={onClose}>{children}</ProductModalContext.Provider>;
}

export function useCloseProductModalOnAddToCart(): (() => void) | null {
  return useContext(ProductModalContext);
}
