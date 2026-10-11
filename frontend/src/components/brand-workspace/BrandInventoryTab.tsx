'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { MobileCard, MobileCardList, MobileField, MobileFields } from '@/components/shared/MobileCard';
import { useInventory } from '@/hooks/useInventory';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useFilterStore } from '@/store/filterStore';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

export function BrandInventoryTab({ brand, outletId }: { brand: string; outletId: string }) {
  const { customFrom, customTo } = useFilterStore();
  const filterKey = `${outletId}|${customFrom}|${customTo}`;
  const [page, setPage] = useResettingPage(filterKey);
  const { data, isLoading, isError } = useInventory(page, 12, {}, { outletId, brand });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stock Levels</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Failed to load inventory.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Purchased</TableHead>
                    <TableHead className="text-right">Consumed</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>As of</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.itemName}</TableCell>
                      <TableCell>{i.outletName}</TableCell>
                      <TableCell>{i.category ?? '—'}</TableCell>
                      <TableCell>{i.store ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatNumber(i.openingStock)}</TableCell>
                      <TableCell className="text-right">{formatNumber(i.purchasedQty)}</TableCell>
                      <TableCell className="text-right">{formatNumber(i.consumedQty)}</TableCell>
                      <TableCell className="text-right">{formatNumber(i.closingStock)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(i.stockValue)}</TableCell>
                      <TableCell>{formatDate(i.stockDate)}</TableCell>
                      <TableCell>{i.isLowStock ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <MobileCardList>
              {/* The table shows its header row when empty; a bare card list would show nothing at all. */}
              {data.rows.length === 0 && <p className="text-sm text-muted-foreground">No stock data for this period.</p>}
              {data.rows.map((i) => (
                <MobileCard
                  key={i.id}
                  title={i.itemName}
                  subtitle={[i.outletName, i.category, i.store].filter(Boolean).join(' · ')}
                  aside={i.isLowStock ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="secondary">OK</Badge>}
                >
                  <MobileFields>
                    <MobileField label="Closing">{formatNumber(i.closingStock)}</MobileField>
                    <MobileField label="Value">{formatCurrency(i.stockValue)}</MobileField>
                    <MobileField label="Opening">{formatNumber(i.openingStock)}</MobileField>
                    <MobileField label="Purchased">{formatNumber(i.purchasedQty)}</MobileField>
                    <MobileField label="Consumed">{formatNumber(i.consumedQty)}</MobileField>
                    <MobileField label="As of">{formatDate(i.stockDate)}</MobileField>
                  </MobileFields>
                </MobileCard>
              ))}
            </MobileCardList>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
