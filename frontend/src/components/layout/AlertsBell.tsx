'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useMissingClosings } from '@/hooks/useAlerts';
import { useAuthStore } from '@/store/authStore';
import { useFilterStore } from '@/store/filterStore';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Which outlets still owe an Actual Closing, for super admins.
 *
 * Nothing is stored server side: the list is recomputed per request, so an outlet drops off as
 * soon as it enters its figures rather than needing anything to be marked as read.
 */
export function AlertsBell() {
  const role = useAuthStore((s) => s.user)?.role;
  const { data, isLoading } = useMissingClosings();
  const setOutletId = useFilterStore((s) => s.setOutletId);
  const setCustomRange = useFilterStore((s) => s.setCustomRange);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (role !== 'SUPER_ADMIN') return null;

  const rows = data ?? [];

  function openReconciliation(row: { outletId: string; brand: string; date: string }) {
    // The reconciliation page reads the outlet and date from the filter store, so pointing it at
    // the offending day is a matter of setting them before routing.
    setOutletId(row.outletId);
    setCustomRange(row.date, row.date);
    setOpen(false);
    router.push(`/${row.brand.toLowerCase()}/reconciliation`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={rows.length > 0 ? `${rows.length} outlet-days missing closing` : 'No alerts'}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'relative')}
      >
        <Bell className="h-5 w-5" />
        {rows.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {rows.length}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Closing not entered</p>
          <p className="text-xs text-muted-foreground">
            Checked from 8 AM for the previous day, over the last 3 days.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">All outlets are up to date.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {rows.map((row) => (
              <button
                key={`${row.outletId}|${row.date}`}
                type="button"
                onClick={() => openReconciliation(row)}
                className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted"
              >
                <span className="text-sm font-medium">{row.outletName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(row.date)} · {row.filled} of {row.expected} entered
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
