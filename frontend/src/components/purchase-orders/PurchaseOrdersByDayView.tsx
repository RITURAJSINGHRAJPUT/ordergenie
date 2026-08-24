'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePurchaseOrderItemsByDay } from '@/hooks/usePurchaseOrders';
import { formatDate } from '@/lib/format';

export function PurchaseOrdersByDayView({ brand, outletId }: { brand: string; outletId: string }) {
  const { data, isLoading, isError } = usePurchaseOrderItemsByDay({ overrides: { outletId, brand } });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Failed to load purchase order items.</p>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No purchase order items in this date range.</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((day) => (
        <Card key={day.date}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{formatDate(day.date)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.items.map((item) => (
                  <TableRow key={`${item.itemName}|${item.unit ?? ''}`}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>{item.unit ?? '—'}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
