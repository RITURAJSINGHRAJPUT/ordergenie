'use client';

import { BrandClassBItemsTab } from '@/components/brand-workspace/BrandClassBItemsTab';
import { useBrandFilter } from '@/lib/brand-filter-context';

export default function AikoClassBItemsPage() {
  const { outletId } = useBrandFilter();
  return <BrandClassBItemsTab brand="Aiko" outletId={outletId} />;
}
