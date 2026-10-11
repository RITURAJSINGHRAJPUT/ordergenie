'use client';

import { useId, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { MobileCard, MobileCardList, MobileField, MobileFields } from '@/components/shared/MobileCard';
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
            <div className="hidden overflow-x-auto md:block">
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
            <MobileCardList>
              {data.rows.map((row) => (
                <SoldOutCard
                  key={`${outletId}|${date}|${row.itemName}`}
                  row={row}
                  outletId={outletId}
                  date={date}
                  canEdit={!isViewer}
                />
              ))}
            </MobileCardList>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}

        {!isAllOutlets && !isViewer && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="w-full space-y-1 sm:w-auto">
              <Label htmlFor="new-sold-out-item">Item</Label>
              <Input
                id="new-sold-out-item"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Tiramisu"
                className="w-full sm:w-48"
              />
            </div>
            {/* Below sm the qty box grows to share its row with + Add rather than sit alone. */}
            <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
              <Label htmlFor="new-sold-out-qty">Missed</Label>
              <Input
                id="new-sold-out-qty"
                type="number"
                step="1"
                min="0"
                value={newMissedQty}
                onChange={(e) => setNewMissedQty(sanitizeQty(e.target.value))}
                className="w-full text-right sm:w-24"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="pointer-coarse:h-10"
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

interface SoldOutRowProps {
  row: SoldOutRow;
  outletId: string;
  date: string;
  canEdit: boolean;
}

/** Missed-qty edit state shared by the table row (md and up) and the card (phones) for the same data row. */
function useMissedQtyEditor(row: SoldOutRow, outletId: string, date: string) {
  const upsert = useUpsertSoldOutEntry();
  const [missedQty, setMissedQty] = useState(String(row.missedQty));

  // useState only reads its initial value, so re-seed when the server number moves — otherwise
  // a refetch (or another user's save) leaves the box showing a stale figure.
  const [serverMissedQty, setServerMissedQty] = useState(row.missedQty);
  if (serverMissedQty !== row.missedQty) {
    setServerMissedQty(row.missedQty);
    setMissedQty(String(row.missedQty));
  }

  function handleSave() {
    upsert.mutate({ outletId, itemName: row.itemName, date, missedQty: Number(missedQty || 0) });
  }

  return {
    missedQty,
    setMissedQty: (raw: string) => setMissedQty(sanitizeQty(raw)),
    dirty: Number(missedQty || 0) !== row.missedQty,
    saving: upsert.isPending,
    handleSave,
  };
}

function SoldOutRowCells({ row, outletId, date, canEdit }: SoldOutRowProps) {
  const editor = useMissedQtyEditor(row, outletId, date);

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
            value={editor.missedQty}
            onChange={(e) => editor.setMissedQty(e.target.value)}
            className="h-8 w-24 text-right pointer-coarse:h-8"
          />
        ) : (
          formatNumber(row.missedQty)
        )}
      </TableCell>
      <TableCell className="text-right">{ratioBadge(row.ratio)}</TableCell>
      <TableCell>
        {canEdit && (
          <Button size="sm" variant="outline" disabled={!editor.dirty || editor.saving} onClick={editor.handleSave}>
            Save
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function SoldOutCard({ row, outletId, date, canEdit }: SoldOutRowProps) {
  const editor = useMissedQtyEditor(row, outletId, date);
  const inputId = useId();

  return (
    <MobileCard
      title={
        <>
          {row.itemName}
          {!row.hasEntry && (
            <Badge variant="outline" className="ml-2 align-middle">
              Not entered
            </Badge>
          )}
        </>
      }
      aside={
        <>
          <div className="text-[11px] text-muted-foreground">Ratio</div>
          {ratioBadge(row.ratio)}
        </>
      }
    >
      <MobileFields>
        <MobileField label="Sold">{formatNumber(row.soldQty)}</MobileField>
        {canEdit ? (
          <div className="min-w-0 space-y-1">
            <dt>
              <Label htmlFor={inputId} className="text-[11px] text-muted-foreground">
                Missed
              </Label>
            </dt>
            <dd>
              <Input
                id={inputId}
                type="number"
                step="1"
                min="0"
                value={editor.missedQty}
                onChange={(e) => editor.setMissedQty(e.target.value)}
                className="text-right"
              />
            </dd>
          </div>
        ) : (
          <MobileField label="Missed">{formatNumber(row.missedQty)}</MobileField>
        )}
      </MobileFields>
      {canEdit && (
        <Button variant="outline" className="w-full" disabled={!editor.dirty || editor.saving} onClick={editor.handleSave}>
          Save
        </Button>
      )}
    </MobileCard>
  );
}
