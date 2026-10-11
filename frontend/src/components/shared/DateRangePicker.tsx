'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  // Draft selection, live only while the popover is open. Starting fresh (rather than
  // seeding it with the already-complete committed range) is required so the first click
  // of a new selection begins a new range instead of react-day-picker snapping it to the
  // stale committed endpoint and completing/closing after a single click.
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setDraft(undefined);
  }

  function handleSelect(next: DateRange | undefined) {
    if (!next?.from) {
      // Re-clicking the in-progress start date clears it in react-day-picker; treat that as
      // confirming a single-day selection instead of losing the selection entirely.
      if (draft?.from) {
        const day = toIso(draft.from);
        onChange(day, day);
        setDraft(undefined);
        setOpen(false);
      }
      return;
    }
    if (next.to) {
      onChange(toIso(next.from), toIso(next.to));
      setDraft(undefined);
      setOpen(false);
      return;
    }
    setDraft(next);
  }

  const label =
    from && to
      ? from === to
        ? format(parseISO(from), 'd MMM yyyy')
        : `${format(parseISO(from), 'd MMM yyyy')} – ${format(parseISO(to), 'd MMM yyyy')}`
      : 'Select dates';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full justify-start gap-2 font-normal sm:w-auto', className)}
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          min={1}
          numberOfMonths={isMobile ? 1 : 2}
          selected={draft}
          defaultMonth={from ? parseISO(from) : undefined}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
