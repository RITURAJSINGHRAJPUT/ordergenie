'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/shared/Pagination';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { PurchaseOrderDetailDialog } from '@/components/purchase-orders/PurchaseOrderDetailDialog';
import { STATUS_VARIANT } from '@/components/purchase-orders/status';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useOutlets } from '@/hooks/useOutlets';
import { useFilterStore } from '@/store/filterStore';
import { formatCurrency, formatDate } from '@/lib/format';

// PENDING/CANCELLED come from the inbound PO webhook (purchaseOrderWebhook.service.ts).
// PARTIALLY_RECEIVED/RECEIVED come from a different source — the separate get_purchase
// sync (purchaseSync.service.ts), which links each delivered invoice back to its PO via
// po_id and never writes PENDING/CANCELLED itself.
// Offered together here so admins can check both "ordered" and "received" state
// from one screen, even though they're populated by two different pipelines.
const STATUS_OPTIONS = ['all', 'PENDING', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

export function ReceivedPurchaseOrdersTab() {
  const { outletId, customFrom, customTo, setOutletId } = useFilterStore();
  const { data: outlets } = useOutlets();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useResettingPage(`${status}|${outletId}|${customFrom}|${customTo}|${search}`);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filtered by when goods are due to arrive, not when the PO was raised — same basis
  // Reconciliation uses. See dateClause() in purchaseOrders.service.ts for the fallback.
  const { data, isLoading, isError } = usePurchaseOrders(page, 12, {
    status,
    search: search || undefined,
    dateField: 'expectedDate',
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {status === 'RECEIVED' || status === 'PARTIALLY_RECEIVED' ? (
          <>
            <strong>{status === 'RECEIVED' ? 'Received' : 'Partially received'}</strong> purchase orders come from
            the Purchase API sync (get_purchase), synced every 15 minutes — these are invoices for goods delivered
            and added to stock, matched back to their PO by Petpooja&apos;s po_id.
            {status === 'PARTIALLY_RECEIVED' && ' Some line items are still awaiting further delivery.'}
          </>
        ) : status === 'PENDING' || status === 'CANCELLED' ? (
          <>
            <strong>{status === 'PENDING' ? 'Pending' : 'Cancelled'}</strong> purchase orders come from the inbound
            Purchase Order webhook (API 8) — Petpooja pushes these to{' '}
            <code className="text-xs">/api/webhooks/petpooja/purchase-order</code> the moment a PO is saved on
            their end, before anything has actually been received.
          </>
        ) : (
          <>
            Showing every status — <strong>Pending</strong>/<strong>Cancelled</strong> come from the inbound
            Purchase Order webhook (API 8) the moment a PO is saved on Petpooja&apos;s end, while{' '}
            <strong>Partially Received</strong>/<strong>Received</strong> come from the separate Purchase API sync
            (get_purchase, every 15 minutes) as goods are actually delivered.
          </>
        )}{' '}
        This is a read-only view of local data, not a live Petpooja call. The date filter matches{' '}
        <strong>Expected Date</strong> — POs that arrive without one fall back to their order date.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter />
        </div>
        <div className="flex items-end gap-3">
          <Input
            placeholder="Search PO number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[180px]"
          />
          <Select value={outletId} onValueChange={(v) => setOutletId(v ?? 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              {(outlets ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v ?? 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'all' ? 'All Statuses' : s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Received Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Failed to load purchase orders.</p>
          ) : data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {status === 'all'
                ? 'No purchase orders in this date range.'
                : `No ${status.toLowerCase().replace('_', ' ')} purchase orders in this date range.`}
            </p>
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
                      <TableHead>Received</TableHead>
                      <TableHead>Created On</TableHead>
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
                        <TableCell>{formatDate(po.orderDate)}</TableCell>
                        <TableCell>{po.petpoojaCreatedAt ? formatDate(po.petpoojaCreatedAt) : '—'}</TableCell>
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
      </Card>

      <PurchaseOrderDetailDialog id={selectedId} onClose={() => setSelectedId(null)} allowPdfDownload />
    </div>
  );
}
