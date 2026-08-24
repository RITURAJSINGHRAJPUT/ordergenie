'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface BrandFilterValue {
  outletId: string;
  setOutletId: (id: string) => void;
  /** Lets a brand tab render extra controls inline in the shared date-range/Fetch toolbar. */
  toolbarExtra: ReactNode;
  setToolbarExtra: (node: ReactNode) => void;
}

const BrandFilterContext = createContext<BrandFilterValue | null>(null);

export function BrandFilterProvider({ children }: { children: ReactNode }) {
  const [outletId, setOutletId] = useState('all');
  const [toolbarExtra, setToolbarExtra] = useState<ReactNode>(null);
  return (
    <BrandFilterContext.Provider value={{ outletId, setOutletId, toolbarExtra, setToolbarExtra }}>
      {children}
    </BrandFilterContext.Provider>
  );
}

export function useBrandFilter(): BrandFilterValue {
  const ctx = useContext(BrandFilterContext);
  if (!ctx) throw new Error('useBrandFilter must be used within a BrandFilterProvider');
  return ctx;
}
