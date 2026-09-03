'use client';

import type { ReactNode } from 'react';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { useFilterStore } from '@/store/filterStore';

export function DateRangeFilter({ extra }: { extra?: ReactNode }) {
  const { customFrom, customTo, setCustomRange } = useFilterStore();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <DateRangePicker from={customFrom ?? ''} to={customTo ?? ''} onChange={setCustomRange} />
      {extra}
    </div>
  );
}
