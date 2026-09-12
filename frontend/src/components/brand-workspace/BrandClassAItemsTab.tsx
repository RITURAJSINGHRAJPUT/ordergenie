'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useClassAItems,
  useClassAItemsSummary,
  useAddClassAItem,
  useRemoveClassAItem,
} from '@/hooks/useClassAItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ClassAItemSummaryRow, ClassAItemType } from '@/types/api';

export function BrandClassAItemsTab({ brand, outletId }: { brand: string; outletId: string }) {
  const isViewer = useAuthStore((s) => s.user)?.role === 'VIEWER';
  const { data: summary, isLoading, isError } = useClassAItemsSummary({ brand, outletId });
  const { data: entries } = useClassAItems(brand);
  const { data: categories } = useItemCategories();
  const addItem = useAddClassAItem();
  const removeItem = useRemoveClassAItem();

  const [type, setType] = useState<ClassAItemType>('ITEM');
  const [value, setValue] = useState('');

  function handleAdd() {
    if (!value.trim()) return;
    addItem.mutate({ brand, type, value: value.trim() }, { onSuccess: () => setValue('') });
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError || !summary ? (
        <p className="text-sm text-destructive">Failed to load Class A items.</p>
      ) : summary.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Class A items yet — add one below.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {summary.map((row) => (
            <ClassAItemCard key={row.key} row={row} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage Class A Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isViewer && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="class-a-type">Type</Label>
                <Select value={type} onValueChange={(v) => { setType((v as ClassAItemType) ?? 'ITEM'); setValue(''); }}>
                  <SelectTrigger id="class-a-type" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITEM">Item</SelectItem>
                    <SelectItem value="CATEGORY">Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === 'CATEGORY' ? (
                <div className="space-y-1">
                  <Label htmlFor="class-a-category">Category</Label>
                  <Select value={value} onValueChange={(v) => setValue(v ?? '')}>
                    <SelectTrigger id="class-a-category" className="w-[200px]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="class-a-value">Item Name</Label>
                  <Input id="class-a-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Coke" className="w-[200px]" />
                </div>
              )}
              <Button onClick={handleAdd} disabled={!value.trim() || addItem.isPending}>
                Add
              </Button>
            </div>
          )}

          {!isViewer && addItem.suggestions.length > 0 && (
            <SuggestionChips suggestions={addItem.suggestions} onPick={(name) => { setValue(name); addItem.clearSuggestions(); }} />
          )}

          <div className="flex flex-wrap gap-2">
            {entries?.map((entry) => (
              <Badge key={entry.id} variant="secondary" className="gap-1 pr-1">
                {entry.value}
                <span className="text-muted-foreground">({entry.type === 'ITEM' ? 'item' : 'category'})</span>
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => removeItem.mutate({ id: entry.id, brand })}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export function SuggestionChips({ suggestions, onPick }: { suggestions: string[]; onPick: (name: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Did you mean:</p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassAItemCard({ row }: { row: ClassAItemSummaryRow }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{row.itemName}</CardTitle>
        {row.category && <p className="text-xs text-muted-foreground">{row.category}</p>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{formatNumber(row.quantitySold)}</div>
        <p className="text-xs text-muted-foreground">units sold</p>
        <div className="mt-2 text-sm font-medium">{formatCurrency(row.revenue)}</div>
        <p className="text-xs text-muted-foreground">revenue &middot; avg {formatCurrency(row.averagePrice)}</p>
      </CardContent>
    </Card>
  );
}
