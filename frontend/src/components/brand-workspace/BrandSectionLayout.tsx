'use client';

import { type ReactNode } from 'react';
import { OutletCards } from '@/components/shared/OutletCards';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { BrandFilterProvider, useBrandFilter } from '@/lib/brand-filter-context';

export function BrandSectionLayout({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <BrandFilterProvider>
      <BrandSectionLayoutInner brand={brand}>{children}</BrandSectionLayoutInner>
    </BrandFilterProvider>
  );
}

function BrandSectionLayoutInner({ brand, children }: { brand: string; children: ReactNode }) {
  // Out-of-reach pages (another brand entirely, or admin-only ones like sales-api) are
  // redirected centrally by the protected layout's route guard, off the same allowlist
  // that builds the sidebar — nothing brand-specific to enforce here.
  const { outletId, setOutletId, toolbarExtra } = useBrandFilter();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{brand}</h1>

      <OutletCards brand={brand} value={outletId} onChange={setOutletId} />
      <DateRangeFilter extra={toolbarExtra} />

      <div>{children}</div>
    </div>
  );
}
