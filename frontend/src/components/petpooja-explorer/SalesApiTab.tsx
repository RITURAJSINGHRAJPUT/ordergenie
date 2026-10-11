'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { useOutlets } from '@/hooks/useOutlets';
import { usePetpoojaExplorer } from '@/hooks/usePetpoojaExplorer';
import { downloadCsv } from '@/lib/csv';
import { triggerBlobDownload } from '@/lib/download';
import { ExplorerResults } from '@/components/petpooja-explorer/ExplorerResults';
import type { ExplorerResult, Outlet } from '@/types/api';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eligibleOutlets(outlets: Outlet[] | undefined, brand: string): Outlet[] {
  if (!outlets) return [];
  return outlets.filter((o) => o.brand === brand && o.salesSyncCode);
}

function dayCount(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

export function SalesApiTab({ brand }: { brand: string }) {
  const { data: outlets } = useOutlets();
  const brandOutlets = useMemo(() => eligibleOutlets(outlets, brand), [outlets, brand]);

  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>(() => brandOutlets.map((o) => o.id));
  const [prevBrandOutletsKey, setPrevBrandOutletsKey] = useState(brandOutlets.map((o) => o.id).join(','));
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ExplorerResult | null>(null);
  // Bumped on each successful fetch and used as ExplorerResults' `key`, so a fresh
  // result remounts the component and its pagination resets to page 1 instead of
  // clamping to whatever page the previous (possibly longer) result left it on.
  const [fetchSeq, setFetchSeq] = useState(0);

  const brandOutletsKey = brandOutlets.map((o) => o.id).join(',');
  if (brandOutletsKey !== prevBrandOutletsKey) {
    setPrevBrandOutletsKey(brandOutletsKey);
    setSelectedOutletIds(brandOutlets.map((o) => o.id));
  }

  const explorer = usePetpoojaExplorer();

  function toggleOutlet(id: string, checked: boolean) {
    setSelectedOutletIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function handleFetch() {
    setExpanded(new Set());
    explorer.mutate(
      { apiType: 'orders', outletIds: selectedOutletIds, fromDate, toDate },
      { onSuccess: (data) => { setResult(data); setFetchSeq((n) => n + 1); } }
    );
  }

  const units = dayCount(fromDate, toDate);
  const fetchLabel = `Fetch ${selectedOutletIds.length} outlet${selectedOutletIds.length === 1 ? '' : 's'} × ${units} day${units === 1 ? '' : 's'}`;

  function exportCsv() {
    if (!result || result.records.length === 0) return;
    const rows = result.records.map((r) => {
      const flat: Record<string, unknown> = { ...r };
      if ('items' in flat) {
        flat.items = JSON.stringify((flat as { items?: unknown }).items);
      }
      return flat;
    });
    downloadCsv(`${brand.toLowerCase()}-sales-api-${fromDate}-to-${toDate}.csv`, rows);
  }

  function exportJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    triggerBlobDownload(blob, `${brand.toLowerCase()}-sales-api-${fromDate}-to-${toDate}.json`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Calls the real Petpooja Orders API directly for {brand}&apos;s outlets, bypassing the production sync pipeline. T-1: enter today&apos;s
        date to get yesterday&apos;s orders.
      </p>

      <DateRangePicker
        from={fromDate}
        to={toDate}
        onChange={(nextFrom, nextTo) => {
          setFromDate(nextFrom);
          setToDate(nextTo);
        }}
      />

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm">
            Outlets ({selectedOutletIds.length}/{brandOutlets.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedOutletIds(brandOutlets.map((o) => o.id))}>
              All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedOutletIds([])}>
              None
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {brandOutlets.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <Checkbox
                  id={`sales-api-outlet-${o.id}`}
                  checked={selectedOutletIds.includes(o.id)}
                  onCheckedChange={(c) => toggleOutlet(o.id, c === true)}
                />
                <Label htmlFor={`sales-api-outlet-${o.id}`} className="flex-1 py-1.5 text-sm font-normal md:py-0">
                  {o.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" disabled={selectedOutletIds.length === 0 || explorer.isPending} onClick={handleFetch}>
        {explorer.isPending ? 'Fetching...' : fetchLabel}
      </Button>

      {result && (
        <ExplorerResults key={fetchSeq} result={result} expanded={expanded} setExpanded={setExpanded} onExportCsv={exportCsv} onExportJson={exportJson} />
      )}
    </div>
  );
}
