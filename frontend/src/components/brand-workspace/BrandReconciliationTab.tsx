'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { useReconciliation, useUpsertReconciliationEntry } from '@/hooks/useReconciliation';
import { useAddClassAItem, useRemoveClassAItem } from '@/hooks/useClassAItems';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useFilterStore } from '@/store/filterStore';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatNumber } from '@/lib/format';
import type { ReconciliationRow } from '@/types/api';

const VARIANCE_ALERT_PCT = 10;

function sanitizeQty(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function varianceTone(variance: number, base: number): 'alert' | 'normal' {
  const pct = base !== 0 ? (Math.abs(variance) / Math.abs(base)) * 100 : variance !== 0 ? 100 : 0;
  return pct > VARIANCE_ALERT_PCT ? 'alert' : 'normal';
}

function varianceBadge(variance: number, base: number) {
  const alert = varianceTone(variance, base) === 'alert';
  return (
    <Badge variant={alert ? 'destructive' : 'secondary'}>
      {variance > 0 ? '+' : ''}
      {formatNumber(variance)}
    </Badge>
  );
}

/** Shared editable Opening/Actual Closing + save state, used by both the table row (tablet/desktop) and card (mobile) renderings of the same data row. */
function useRowEditor(row: ReconciliationRow, outletId: string, date: string) {
  const upsert = useUpsertReconciliationEntry();
  const [opening, setOpening] = useState(String(row.opening));
  const [actualClosing, setActualClosing] = useState(String(row.actualClosing));

  const dirty = Number(opening || 0) !== row.opening || Number(actualClosing || 0) !== row.actualClosing;

  function handleSave() {
    upsert.mutate({
      outletId,
      itemName: row.itemName,
      date,
      opening: Number(opening || 0),
      actualClosing: Number(actualClosing || 0),
    });
  }

  return {
    opening,
    setOpening: (v: string) => setOpening(sanitizeQty(v)),
    actualClosing,
    setActualClosing: (v: string) => setActualClosing(sanitizeQty(v)),
    dirty,
    saving: upsert.isPending,
    handleSave,
  };
}

export function BrandReconciliationTab({ brand, outletId }: { brand: string; outletId: string }) {
  const { customTo } = useFilterStore();
  const { user } = useAuthStore();
  const isHeadChef = user?.role === 'HEAD_CHEF';
  const isViewer = user?.role === 'VIEWER';
  const date = customTo ?? todayIso();
  const filterKey = `${outletId}|${brand}|${date}`;
  const [page, setPage] = useResettingPage(filterKey);
  const { data, isLoading, isError } = useReconciliation(page, 12, outletId, brand, date);
  const addClassAItem = useAddClassAItem();

  const [newItemName, setNewItemName] = useState('');
  const isAllOutlets = outletId === 'all';

  function handleAddIngredient() {
    if (!newItemName.trim() || isAllOutlets) return;
    addClassAItem.mutate(
      { brand, type: 'ITEM', value: newItemName.trim() },
      { onSuccess: () => setNewItemName('') }
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingredient Reconciliation</CardTitle>
          <CardDescription>
            Showing reconciliation for <strong>{formatDate(date)}</strong> — items selected in{' '}
            <strong>Class A Items</strong> for {brand}. Opening/Closing are manual, Sales/PO are synced, Predicted =
            forecast or 7-day avg +15%. Change date above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAllOutlets ? (
            <p className="text-sm text-muted-foreground">Select a specific outlet above to view its reconciliation.</p>
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Failed to load reconciliation data.</p>
          ) : data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isHeadChef
                ? 'No items selected yet for this outlet.'
                : (
                  <>
                    No items selected yet. Add one below, or manage categories in{' '}
                    <a href={`/${brand.toLowerCase()}/class-a-items`} className="underline">
                      Class A Items
                    </a>
                    .
                  </>
                )}
            </p>
          ) : (
            <>
              {/* Tablet and up: full data table, horizontally scrollable if it still doesn't fit. */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-center">Opening</TableHead>
                      <TableHead className="text-center">
                        <div className="leading-tight">
                          Closing
                          <br />
                          (AI)
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="leading-tight">
                          Actual
                          <br />
                          Closing
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Sales</TableHead>
                      <TableHead className="text-center">
                        <div className="leading-tight">
                          Sales
                          <br />
                          (AI)
                        </div>
                      </TableHead>
                      <TableHead className="text-center">PO</TableHead>
                      <TableHead className="text-center">
                        <div className="leading-tight">
                          Next Day
                          <br />
                          Opening
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="leading-tight">
                          Sales
                          <br />
                          Variance
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="leading-tight">
                          Closing
                          <br />
                          Variance
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Wastage</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <ReconciliationTableRow
                        key={row.itemName}
                        row={row}
                        outletId={outletId}
                        brand={brand}
                        date={date}
                        canManageSelection={!isHeadChef && !isViewer}
                        canEdit={!isViewer}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: stacked cards instead of a cramped 13-column table. */}
              <div className="space-y-3 md:hidden">
                {data.rows.map((row) => (
                  <ReconciliationCard
                    key={row.itemName}
                    row={row}
                    outletId={outletId}
                    brand={brand}
                    date={date}
                    canManageSelection={!isHeadChef && !isViewer}
                    canEdit={!isViewer}
                  />
                ))}
              </div>

              <Pagination meta={data.meta} onPageChange={setPage} />
            </>
          )}

          {!isAllOutlets && !isHeadChef && !isViewer && (
            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
              <div className="w-full space-y-1 sm:w-auto">
                <Label htmlFor="new-ingredient">Add Ingredient</Label>
                <Input
                  id="new-ingredient"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Flour 1kg"
                  className="h-8 w-full sm:w-56"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!newItemName.trim() || addClassAItem.isPending}
                onClick={handleAddIngredient}
              >
                + Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface RowProps {
  row: ReconciliationRow;
  outletId: string;
  brand: string;
  date: string;
  canManageSelection: boolean;
  canEdit: boolean;
}

function ReconciliationTableRow({ row, outletId, brand, date, canManageSelection, canEdit }: RowProps) {
  const editor = useRowEditor(row, outletId, date);
  const removeClassAItem = useRemoveClassAItem();

  return (
    <TableRow>
      <TableCell className="font-medium">
        {row.itemName}
        {!row.hasManualEntry && (
          <Badge variant="outline" className="ml-2">
            Not entered
          </Badge>
        )}
      </TableCell>
      <TableCell>{row.unit ?? '—'}</TableCell>
      <TableCell className="text-center">
        {canEdit ? (
          <Input
            type="number"
            step="1"
            min="0"
            value={editor.opening}
            onChange={(e) => editor.setOpening(e.target.value)}
            className="h-8 w-24 text-center"
          />
        ) : (
          formatNumber(row.opening)
        )}
      </TableCell>
      <TableCell className="text-center">{formatNumber(row.factualClosingAI)}</TableCell>
      <TableCell className="text-center">
        {canEdit ? (
          <Input
            type="number"
            step="1"
            min="0"
            value={editor.actualClosing}
            onChange={(e) => editor.setActualClosing(e.target.value)}
            className="h-8 w-24 text-center"
          />
        ) : (
          formatNumber(row.actualClosing)
        )}
      </TableCell>
      <TableCell className="text-center">{formatNumber(row.salesToday)}</TableCell>
      <TableCell className="text-center">{formatNumber(row.predictedSales)}</TableCell>
      <TableCell className="text-center">{formatNumber(row.poToday)}</TableCell>
      <TableCell className="text-center">{formatNumber(row.nextDayOpening)}</TableCell>
      <TableCell className="text-center">{varianceBadge(row.salesVariance, row.predictedSales)}</TableCell>
      <TableCell className="text-center">{varianceBadge(row.closingVariance, row.factualClosingAI)}</TableCell>
      <TableCell className="text-center">
        <Badge variant={row.derivedWastage > 0 ? 'destructive' : 'secondary'}>{formatNumber(row.derivedWastage)}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {canEdit && (
            <Button size="sm" variant="outline" disabled={!editor.dirty || editor.saving} onClick={editor.handleSave}>
              Save
            </Button>
          )}
          {canManageSelection && (
            <button
              type="button"
              onClick={() => removeClassAItem.mutate({ id: row.classAItemId, brand })}
              title="Remove from selection"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'alert' | 'normal' }) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={tone === 'alert' ? 'font-medium text-destructive' : 'font-medium'}>{value}</div>
    </div>
  );
}

function ReconciliationCard({ row, outletId, brand, date, canManageSelection, canEdit }: RowProps) {
  const editor = useRowEditor(row, outletId, date);
  const removeClassAItem = useRemoveClassAItem();

  return (
    <Card className="p-0">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium leading-snug">
            {row.itemName}
            {row.unit && <span className="ml-1.5 text-xs text-muted-foreground">({row.unit})</span>}
            {!row.hasManualEntry && (
              <Badge variant="outline" className="ml-2 align-middle">
                Not entered
              </Badge>
            )}
          </div>
          {canManageSelection && (
            <button
              type="button"
              onClick={() => removeClassAItem.mutate({ id: row.classAItemId, brand })}
              title="Remove from selection"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {canEdit ? (
            <>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Opening</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={editor.opening}
                  onChange={(e) => editor.setOpening(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Actual Closing</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={editor.actualClosing}
                  onChange={(e) => editor.setActualClosing(e.target.value)}
                  className="h-8"
                />
              </div>
            </>
          ) : (
            <>
              <StatTile label="Opening" value={formatNumber(row.opening)} />
              <StatTile label="Actual Closing" value={formatNumber(row.actualClosing)} />
            </>
          )}
          <StatTile label="Closing (AI)" value={formatNumber(row.factualClosingAI)} />
          <StatTile label="Sales" value={formatNumber(row.salesToday)} />
          <StatTile label="Sales (AI)" value={formatNumber(row.predictedSales)} />
          <StatTile label="PO" value={formatNumber(row.poToday)} />
          <StatTile label="Next Day Opening" value={formatNumber(row.nextDayOpening)} />
          <StatTile
            label="Sales Variance"
            value={`${row.salesVariance > 0 ? '+' : ''}${formatNumber(row.salesVariance)}`}
            tone={varianceTone(row.salesVariance, row.predictedSales)}
          />
          <StatTile
            label="Closing Variance"
            value={`${row.closingVariance > 0 ? '+' : ''}${formatNumber(row.closingVariance)}`}
            tone={varianceTone(row.closingVariance, row.factualClosingAI)}
          />
          <StatTile label="Wastage" value={formatNumber(row.derivedWastage)} tone={row.derivedWastage > 0 ? 'alert' : 'normal'} />
        </div>

        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            disabled={!editor.dirty || editor.saving}
            onClick={editor.handleSave}
            className="w-full"
          >
            Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
