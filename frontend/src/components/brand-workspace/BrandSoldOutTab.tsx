'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { useSoldOut, useUpsertSoldOutEntry } from '@/hooks/useSoldOut';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useFilterStore } from '@/store/filterStore';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatNumber } from '@/lib/format';
import type { SoldOutRow } from '@/types/api';

const RATIO_ALERT_PCT = 20;

function sanitizeQty(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ratioBadge(ratio: number | null) {
  if (ratio === null) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={ratio > RATIO_ALERT_PCT ? 'destructive' : 'secondary'}>{formatNumber(ratio)}%</Badge>;
}

export function BrandSoldOutTab({ brand, outletId }: { brand: string; outletId: string }) {
  const { customTo } = useFilterStore();
  const isViewer = useAuthStore((s) => s.user)?.role === 'VIEWER';
  const date = customTo ?? todayIso();
  const filterKey = `${outletId}|${brand}|${date}`;
  const [page, setPage] = useResettingPage(filterKey);
  const { data, isLoading, isError } = useSoldOut(page, 12, outletId, date);
  const upsert = useUpsertSoldOutEntry();

  const [newItemName, setNewItemName] = useState('');
  const [newMissedQty, setNewMissedQty] = useState('');
  const isAllOutlets = outletId === 'all';

  function handleAddItem() {
    if (!newItemName.trim() || !newMissedQty || isAllOutlets) return;
    upsert.mutate(
      { outletId, itemName: newItemName.trim(), date, missedQty: Number(newMissedQty) },
      { onSuccess: () => { setNewItemName(''); setNewMissedQty(''); } }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sold Out</CardTitle>
        <CardDescription>
          Showing sold-out demand for <strong>{formatDate(date)}</strong> — Sold is pulled from real synced sales;
          Missed is entered manually (how many people asked for an item after it ran out). Ratio = Missed ÷ (Sold +
          Missed). Change the date via the date filter above.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAllOutlets ? (
          <p className="text-sm text-muted-foreground">Select a specific outlet above to view sold-out data.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Failed to load sold-out data.</p>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales or sold-out entries for this outlet on this date.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Missed</TableHead>
                    <TableHead className="text-right">Ratio</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <SoldOutRowCells
                      key={`${outletId}|${date}|${row.itemName}`}
                      row={row}
                      outletId={outletId}
                      date={date}
                      canEdit={!isViewer}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}

        {!isAllOutlets && !isViewer && (
          <div className="flex items-end gap-2 border-t pt-3">
            <div className="space-y-1">
              <Label htmlFor="new-sold-out-item">Item</Label>
              <Input
                id="new-sold-out-item"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Tiramisu"
                className="h-8 w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-sold-out-qty">Missed</Label>
              <Input
                id="new-sold-out-qty"
                type="number"
                step="1"
                min="0"
                value={newMissedQty}
                onChange={(e) => setNewMissedQty(sanitizeQty(e.target.value))}
                className="h-8 w-24 text-right"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!newItemName.trim() || !newMissedQty || upsert.isPending}
              onClick={handleAddItem}
            >
              + Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SoldOutRowCells({
  row,
  outletId,
  date,
  canEdit,
}: {
  row: SoldOutRow;
  outletId: string;
  date: string;
  canEdit: boolean;
}) {
  const upsert = useUpsertSoldOutEntry();
  const [missedQty, setMissedQty] = useState(String(row.missedQty));

  // useState only reads its initial value, so re-seed when the server number moves — otherwise
  // a refetch (or another user's save) leaves the box showing a stale figure.
  const [serverMissedQty, setServerMissedQty] = useState(row.missedQty);
  if (serverMissedQty !== row.missedQty) {
    setServerMissedQty(row.missedQty);
    setMissedQty(String(row.missedQty));
  }

  const dirty = Number(missedQty || 0) !== row.missedQty;

  function handleSave() {
    upsert.mutate({ outletId, itemName: row.itemName, date, missedQty: Number(missedQty || 0) });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {row.itemName}
        {!row.hasEntry && (
          <Badge variant="outline" className="ml-2">
            Not entered
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">{formatNumber(row.soldQty)}</TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <Input
            type="number"
            step="1"
            min="0"
            value={missedQty}
            onChange={(e) => setMissedQty(sanitizeQty(e.target.value))}
            className="h-8 w-24 text-right"
          />
        ) : (
          formatNumber(row.missedQty)
        )}
      </TableCell>
      <TableCell className="text-right">{ratioBadge(row.ratio)}</TableCell>
      <TableCell>
        {canEdit && (
          <Button size="sm" variant="outline" disabled={!dirty || upsert.isPending} onClick={handleSave}>
            Save
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
