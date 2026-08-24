'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
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
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.user)?.role === 'ADMIN';
  const { outletId, setOutletId, toolbarExtra } = useBrandFilter();

  const basePath = `/${brand.toLowerCase()}`;

  useEffect(() => {
    if (!isAdmin && pathname === `${basePath}/sales-api`) {
      router.replace(`${basePath}/overview`);
    }
  }, [isAdmin, pathname, router, basePath]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{brand}</h1>

      <OutletCards brand={brand} value={outletId} onChange={setOutletId} />
      <DateRangeFilter extra={toolbarExtra} />

      <div>{children}</div>
    </div>
  );
}
