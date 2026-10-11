'use client';

import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/types/api';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
}) {
  if (!meta) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-3 text-sm text-muted-foreground">
      <span>
        Page {meta.page} of {meta.totalPages}
        <span className="hidden sm:inline"> &middot; {meta.total.toLocaleString('en-IN')} records</span>
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
