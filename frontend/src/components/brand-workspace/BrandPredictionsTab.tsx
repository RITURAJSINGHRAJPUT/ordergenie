'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { MobileCard, MobileCardList } from '@/components/shared/MobileCard';
import { usePredictedSales } from '@/hooks/usePredictedSales';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useFilterStore } from '@/store/filterStore';
import { formatDate, formatNumber } from '@/lib/format';

export function BrandPredictionsTab({ brand, outletId }: { brand: string; outletId: string }) {
  const { customFrom, customTo } = useFilterStore();
  const from = customFrom ?? '';
  const to = customTo ?? '';
  const filterKey = `${outletId}|${brand}|${from}|${to}`;
  const [page, setPage] = useResettingPage(filterKey);
  const { data, isLoading, isError } = usePredictedSales(page, 12, outletId, from, to);
  const isAllOutlets = outletId === 'all';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales Prediction</CardTitle>
        <CardDescription>
          Imported day-wise sales forecast for {brand} — every item the forecast covers, not just those selected in
          Class A Items. Change the range via the date filter above.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isAllOutlets ? (
          <p className="text-sm text-muted-foreground">Select a specific outlet above to view its predictions.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Failed to load predicted sales.</p>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No forecast data for this outlet in the selected range.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Predicted Qty</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={`${row.stockDate}|${row.itemName}`}>
                      <TableCell>{formatDate(row.stockDate)}</TableCell>
                      <TableCell className="font-medium">{row.itemName}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.predictedQty)}</TableCell>
                      <TableCell className="text-muted-foreground">{row.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <MobileCardList>
              {data.rows.map((row) => (
                <MobileCard
                  key={`${row.stockDate}|${row.itemName}`}
                  title={row.itemName}
                  subtitle={`${formatDate(row.stockDate)} · ${row.source}`}
                  aside={
                    <>
                      <div className="font-semibold tabular-nums">{formatNumber(row.predictedQty)}</div>
                      <div className="text-[11px] text-muted-foreground">predicted</div>
                    </>
                  }
                />
              ))}
            </MobileCardList>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
