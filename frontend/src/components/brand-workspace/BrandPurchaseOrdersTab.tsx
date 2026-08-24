'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/shared/Pagination';
import { PurchaseOrderDetailDialog } from '@/components/purchase-orders/PurchaseOrderDetailDialog';
import { PurchaseOrdersByDayView } from '@/components/purchase-orders/PurchaseOrdersByDayView';
import { STATUS_VARIANT } from '@/components/purchase-orders/status';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useFilterStore } from '@/store/filterStore';
import { useBrandFilter } from '@/lib/brand-filter-context';
import { formatCurrency, formatDate } from '@/lib/format';

type PurchaseOrdersView = 'orders' | 'by-item';

export function BrandPurchaseOrdersTab({ brand, outletId }: { brand: string; outletId: string }) {
  const { customFrom, customTo } = useFilterStore();
  const { setToolbarExtra } = useBrandFilter();
  const [view, setView] = useState<PurchaseOrdersView>('orders');
  const [search, setSearch] = useState('');
  const filterKey = `${outletId}|${customFrom}|${customTo}|${search}`;
  const [page, setPage] = useResettingPage(filterKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError } = usePurchaseOrders(page, 12, { overrides: { outletId, brand }, search: search || undefined });

  // Renders the view toggle inline in the shared date-range/Fetch toolbar (BrandSectionLayout),
  // since this page can't pass it there directly — that toolbar lives in the parent layout.
  useEffect(() => {
    setToolbarExtra(
      <div className="flex items-center gap-1">
        <Button type="button" size="lg" variant={view === 'orders' ? 'default' : 'outline'} onClick={() => setView('orders')}>
          Order wise
        </Button>
        <Button type="button" size="lg" variant={view === 'by-item' ? 'default' : 'outline'} onClick={() => setView('by-item')}>
          Item wise
        </Button>
      </div>
    );
    return () => setToolbarExtra(null);
  }, [view, setToolbarExtra]);

  if (view === 'by-item') {
    return <PurchaseOrdersByDayView brand={brand} outletId={outletId} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Orders</CardTitle>
        <Input
          placeholder="Search PO number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[200px]"
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">Failed to load purchase orders.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Expected Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((po) => (
                    <TableRow key={po.id} className="cursor-pointer" onClick={() => setSelectedId(po.id)}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
                      <TableCell>{po.vendorName}</TableCell>
                      <TableCell>{po.outletName}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[po.status]}>{po.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(po.totalAmount)}</TableCell>
                      <TableCell>{po.expectedDate ? formatDate(po.expectedDate) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <PurchaseOrderDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
    </Card>
  );
}
