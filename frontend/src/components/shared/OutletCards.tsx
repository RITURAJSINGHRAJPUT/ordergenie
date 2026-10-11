'use client';

import { Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useOutlets } from '@/hooks/useOutlets';
import { useFilterStore } from '@/store/filterStore';

export interface OutletCardsProps {
  /**
   * Only show outlets where this field is set — e.g. 'salesSyncCode' on the Sales
   * page, since only those outlets can ever have real synced Sale data. Omit to
   * show every outlet.
   */
  eligibleField?: 'salesSyncCode' | 'inventorySyncCode';
  /** Only show outlets belonging to this brand — e.g. 'Aiko' on a brand workspace page. */
  brand?: string;
  /** Controlled selected outlet id, bypassing the global filter store. Requires onChange. */
  value?: string;
  /** Controlled selection handler, bypassing the global filter store. Requires value. */
  onChange?: (outletId: string) => void;
}

export function OutletCards({ eligibleField, brand, value, onChange }: OutletCardsProps = {}) {
  const { data: allOutlets, isLoading } = useOutlets();
  const store = useFilterStore();
  const outletId = value ?? store.outletId;
  const setOutletId = onChange ?? store.setOutletId;

  if (isLoading || !allOutlets) return null;

  const outlets = allOutlets
    .filter((o) => !eligibleField || o[eligibleField])
    .filter((o) => !brand || o.brand === brand);

  return (
    // Phones get one swipeable row; a wrapped grid of 150px cards would push the page content far down.
    <div className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto scrollbar-none px-3 pb-1 sm:mx-0 sm:px-0 md:flex-wrap md:overflow-visible md:pb-0">
      <OutletCard
        label={brand ? `All ${brand} Outlets` : 'All Outlets'}
        sublabel={`${outlets.length} outlets`}
        active={outletId === 'all'}
        onClick={() => setOutletId('all')}
      />
      {outlets.map((o) => (
        <OutletCard
          key={o.id}
          label={o.name}
          sublabel={[o.brand, o.city].filter(Boolean).join(' · ')}
          active={outletId === o.id}
          onClick={() => setOutletId(o.id)}
        />
      ))}
    </div>
  );
}

function OutletCard({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={cn(
        'w-[150px] shrink-0 snap-start cursor-pointer select-none transition-colors hover:border-primary/50',
        active ? 'border-primary bg-primary/5' : 'border-border'
      )}
    >
      <CardContent className="flex items-center gap-2 p-3">
        <Store className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
        <div className="min-w-0">
          <div className={cn('truncate text-sm font-medium', active && 'text-primary')}>{label}</div>
          {sublabel && <div className="truncate text-xs text-muted-foreground">{sublabel}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
