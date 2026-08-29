'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { useWastageEntries, useCreateWastageEntry, useDeleteWastageEntry } from '@/hooks/useWastage';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useFilterStore } from '@/store/filterStore';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatNumber } from '@/lib/format';
import type { WastageReason } from '@/types/api';

const REASONS: { value: WastageReason; label: string }[] = [
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'SPOILED', label: 'Spoiled' },
  { value: 'PREP_ERROR', label: 'Prep Error' },
  { value: 'DROPPED_DAMAGED', label: 'Dropped/Damaged' },
  { value: 'OTHER', label: 'Other' },
];

const REASON_LABEL: Record<WastageReason, string> = Object.fromEntries(REASONS.map((r) => [r.value, r.label])) as Record<
  WastageReason,
  string
>;

export function BrandWastageTab({ brand, outletId }: { brand: string; outletId: string }) {
  const { customFrom, customTo } = useFilterStore();
  const role = useAuthStore((s) => s.user)?.role;
  const isViewer = role === 'VIEWER';
  // Head Chef reports wastage but can't remove records after the fact (backend enforces
  // the same split — see wastage.routes.ts canCreate/canDelete).
  const canDelete = !isViewer && role !== 'HEAD_CHEF';
  const filterKey = `${outletId}|${customFrom}|${customTo}`;
  const [page, setPage] = useResettingPage(filterKey);
  const { data, isLoading, isError } = useWastageEntries(page, 12, { outletId, brand });
  const createEntry = useCreateWastageEntry();
  const deleteEntry = useDeleteWastageEntry();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [reason, setReason] = useState<WastageReason>('SPOILED');
  const [notes, setNotes] = useState('');

  const isAllOutlets = outletId === 'all';
  const qty = Number(quantity);
  const canSubmit = itemName.trim() && quantity && qty > 0 && !isAllOutlets;

  function handleAdd() {
    if (!canSubmit) return;
    createEntry.mutate(
      {
        outletId,
        itemName: itemName.trim(),
        category: category.trim() || undefined,
        quantity: qty,
        unit: unit.trim() || undefined,
        reason,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setItemName('');
          setCategory('');
          setQuantity('');
          setUnit('');
          setNotes('');
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {!isViewer && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Wastage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAllOutlets && (
            <p className="text-sm text-muted-foreground">Select a specific outlet above to report wastage for it.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="wastage-item">Item Name</Label>
              <Input id="wastage-item" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Tomatoes" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wastage-category">Category</Label>
              <Input id="wastage-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wastage-qty">Quantity</Label>
              <Input id="wastage-qty" type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wastage-unit">Unit</Label>
              <Input id="wastage-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pcs..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wastage-reason">Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason((v as WastageReason) ?? 'OTHER')}>
                <SelectTrigger id="wastage-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wastage-notes">Notes</Label>
            <textarea
              id="wastage-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <Button onClick={handleAdd} disabled={!canSubmit || createEntry.isPending}>
            Add Wastage Entry
          </Button>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wastage Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Failed to load wastage reports.</p>
          ) : data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wastage reported for this period.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{formatDate(w.wastageDate)}</TableCell>
                        <TableCell className="font-medium">{w.itemName}</TableCell>
                        <TableCell>{w.category ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatNumber(w.quantity)}</TableCell>
                        <TableCell>{w.unit ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{REASON_LABEL[w.reason]}</Badge>
                        </TableCell>
                        <TableCell>{w.outletName}</TableCell>
                        <TableCell>{w.reportedByName ?? '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{w.notes ?? '—'}</TableCell>
                        <TableCell>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => deleteEntry.mutate(w.id)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination meta={data.meta} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
