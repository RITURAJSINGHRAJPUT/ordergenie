'use client';

import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { useFilterStore } from '@/store/filterStore';

export function DateRangeFilter({ extra }: { extra?: ReactNode }) {
  const { customFrom, customTo, setCustomRange } = useFilterStore();
  const [draftFrom, setDraftFrom] = useState(customFrom ?? '');
  const [draftTo, setDraftTo] = useState(customTo ?? '');

  const dirty = draftFrom !== (customFrom ?? '') || draftTo !== (customTo ?? '');

  function handleFetch() {
    if (draftFrom && draftTo) {
      setCustomRange(draftFrom, draftTo);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <DateRangePicker
        from={draftFrom}
        to={draftTo}
        onChange={(nextFrom, nextTo) => {
          setDraftFrom(nextFrom);
          setDraftTo(nextTo);
        }}
      />
      {extra}
      {/* size="lg" to match DateRangePicker's trigger button height (h-9) — size="sm" (h-7)
          left an 8px mismatch between the two buttons sitting side by side. */}
      <Button size="lg" disabled={!draftFrom || !draftTo} onClick={handleFetch} variant={dirty ? 'default' : 'outline'}>
        <RefreshCw className="mr-1 h-4 w-4" />
        Fetch
      </Button>
    </div>
  );
}
