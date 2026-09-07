'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePurchaseOrderDetail, usePurchaseOrderPdfDownload } from '@/hooks/usePurchaseOrders';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { STATUS_VARIANT } from './status';

export function PurchaseOrderDetailDialog({
  id,
  onClose,
  allowPdfDownload = false,
}: {
  id: string | null;
  onClose: () => void;
  /** Off by default — only the API Explorer offers the PDF today. */
  allowPdfDownload?: boolean;
}) {
  const { data, isLoading } = usePurchaseOrderDetail(id);
  const download = usePurchaseOrderPdfDownload();

  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{data?.poNumber ?? 'Purchase Order'}</DialogTitle>
            {allowPdfDownload && (
              <Button
                size="sm"
                variant="outline"
                disabled={!data || download.isPending}
                onClick={() => data && download.mutate({ id: data.id, poNumber: data.poNumber })}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {download.isPending ? 'Preparing...' : 'Download PDF'}
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Outlet</div>
                <div className="font-medium">{data.outletName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Vendor</div>
                <div className="font-medium">{data.vendor?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <Badge variant={STATUS_VARIANT[data.status]}>{data.status.replace('_', ' ')}</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Order Date</div>
                <div className="font-medium">{formatDate(data.orderDate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Expected Date</div>
                <div className="font-medium">{data.expectedDate ? formatDate(data.expectedDate) : '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Invoice #</div>
                <div className="font-medium">{data.invoiceNumber ?? '—'}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)} {item.unit}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cgst + item.sgst + item.igst + item.cess)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.receivedQty)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.pendingQty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Tax: </span>
                <span className="font-medium">{formatCurrency(data.taxAmount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold">{formatCurrency(data.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
