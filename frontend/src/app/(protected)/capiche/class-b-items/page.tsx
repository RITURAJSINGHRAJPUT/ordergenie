'use client';

import { BrandClassBItemsTab } from '@/components/brand-workspace/BrandClassBItemsTab';
import { useBrandFilter } from '@/lib/brand-filter-context';

export default function CapicheClassBItemsPage() {
  const { outletId } = useBrandFilter();
  return <BrandClassBItemsTab brand="Capiche" outletId={outletId} />;
}
