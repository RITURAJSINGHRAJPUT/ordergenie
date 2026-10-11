'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Phone layout for table rows: a page renders its `<Table>` inside `hidden md:block` and a
 * `MobileCardList` of these beside it. Styled after ReconciliationCard so every card view in
 * the app reads the same.
 */
export function MobileCardList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-3 md:hidden', className)}>{children}</div>;
}

export function MobileCard({
  title,
  subtitle,
  aside,
  onClick,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Top-right slot — the row's headline amount, a status badge, or icon actions. */
  aside?: ReactNode;
  /** Makes the whole card tappable (open a detail dialog, expand, ...). */
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn('p-0', onClick && 'cursor-pointer transition-colors active:bg-muted/50', className)}
      {...(onClick && {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      })}
    >
      <CardContent className="space-y-3 p-3">
        {/* The aside drops below the title, right-aligned, once the two can't share a line
            without crushing the title (a long PO number beside "PARTIALLY RECEIVED"). */}
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
          <div className="min-w-0 flex-[1_1_10rem]">
            <div className="font-medium leading-snug break-words">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          {aside && <div className="ml-auto shrink-0 text-right">{aside}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Two-up grid of label/value tiles for a MobileCard body. */
export function MobileFields({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-2 gap-2', className)}>{children}</dl>;
}

export function MobileField({
  label,
  children,
  className,
  wide,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  /** Spans both columns — for long text like notes or names. */
  wide?: boolean;
}) {
  return (
    <div className={cn('min-w-0 rounded-md bg-muted/50 px-2.5 py-1.5', wide && 'col-span-2', className)}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}
