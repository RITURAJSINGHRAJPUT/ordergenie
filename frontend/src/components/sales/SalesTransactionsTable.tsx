'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { MobileCard, MobileCardList, MobileField, MobileFields } from '@/components/shared/MobileCard';
import { useSaleDetail } from '@/hooks/useSales';
import { formatCurrency, formatDate, formatNumber, formatTime } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import type { PaginationMeta, SaleRow } from '@/types/api';

const COLUMN_COUNT = 11;

function toCsvRow(s: SaleRow) {
  return {
    invoiceNumber: s.invoiceNumber,
    outletName: s.outletName,
    date: s.date,
    time: s.time,
    customer: s.customer,
    gross: s.gross,
    discount: s.discount,
    tax: s.tax,
    net: s.net,
    paymentMode: s.paymentMode,
  };
}

export function SalesTransactionsTable({
  rows,
  meta,
  isLoading,
  isError,
  onPageChange,
  csvFilename,
}: {
  rows?: SaleRow[];
  meta?: PaginationMeta;
  isLoading: boolean;
  isError: boolean;
  onPageChange: (page: number) => void;
  csvFilename: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Transactions</CardTitle>
        <Button variant="outline" size="sm" onClick={() => rows && downloadCsv(csvFilename, rows.map(toCsvRow))}>
          <Download className="mr-1 h-4 w-4" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError || !rows ? (
          <p className="text-sm text-destructive">Failed to load sales.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => {
                    const isExpanded = expanded.has(s.id);
                    return (
                      <Fragment key={s.id}>
                        <TableRow className="cursor-pointer" onClick={() => toggleRow(s.id)}>
                          <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                          <TableCell className="font-medium">{s.invoiceNumber}</TableCell>
                          <TableCell>{s.outletName}</TableCell>
                          <TableCell>{formatDate(s.date)}</TableCell>
                          <TableCell>{formatTime(s.time)}</TableCell>
                          <TableCell>{s.customer ?? '—'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.gross)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.discount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.tax)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(s.net)}</TableCell>
                          <TableCell>{s.paymentMode}</TableCell>
                        </TableRow>
                        {isExpanded && <SaleItemsRow saleId={s.id} net={s.net} />}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <MobileCardList>
              {rows.map((s) => (
                <SaleCard key={s.id} sale={s} isExpanded={expanded.has(s.id)} onToggle={() => toggleRow(s.id)} />
              ))}
            </MobileCardList>
            <Pagination meta={meta} onPageChange={onPageChange} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SaleItemsRow({ saleId, net }: { saleId: string; net: number }) {
  const { data, isLoading, isError } = useSaleDetail(saleId);

  return (
    <TableRow>
      <TableCell colSpan={COLUMN_COUNT} className="bg-muted/30">
        {isLoading ? (
          <div className="space-y-2 py-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError || !data ? (
          <p className="py-1 text-sm text-destructive">Failed to load item details.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.category ?? '—'}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.discount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-2 py-2 text-right text-sm text-muted-foreground">
              {data.items.length} item{data.items.length === 1 ? '' : 's'} &middot; total {formatCurrency(net)}
            </p>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function SaleCard({ sale, isExpanded, onToggle }: { sale: SaleRow; isExpanded: boolean; onToggle: () => void }) {
  return (
    <MobileCard
      title={sale.invoiceNumber}
      aside={
        <div className="flex items-center gap-1.5">
          <span className="font-semibold">{formatCurrency(sale.net)}</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
        </div>
      }
      onClick={onToggle}
    >
      <MobileFields>
        <MobileField label="Outlet" wide>{sale.outletName}</MobileField>
        <MobileField label="Date · Time">
          {formatDate(sale.date)} · {formatTime(sale.time)}
        </MobileField>
        <MobileField label="Customer">{sale.customer ?? '—'}</MobileField>
        <MobileField label="Gross">{formatCurrency(sale.gross)}</MobileField>
        <MobileField label="Discount">{formatCurrency(sale.discount)}</MobileField>
        <MobileField label="Tax">{formatCurrency(sale.tax)}</MobileField>
        <MobileField label="Payment">{sale.paymentMode}</MobileField>
      </MobileFields>
      {isExpanded && <SaleItemsList saleId={sale.id} net={sale.net} />}
    </MobileCard>
  );
}

/** Phone counterpart of SaleItemsRow — a nested table is unreadable at card width. */
function SaleItemsList({ saleId, net }: { saleId: string; net: number }) {
  const { data, isLoading, isError } = useSaleDetail(saleId);

  // Taps on the item list shouldn't bubble up and collapse the card, same as the desktop detail row.
  return (
    <div className="border-t pt-2" onClick={(e) => e.stopPropagation()}>
      {isLoading ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="py-1 text-sm text-destructive">Failed to load item details.</p>
      ) : (
        <>
          <ul className="divide-y">
            {data.items.map((item, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0 break-words">
                  <div>
                    {item.itemName} <span className="text-muted-foreground">× {formatNumber(item.quantity)}</span>
                  </div>
                  {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                </div>
                <span className="shrink-0 font-medium">{formatCurrency(item.total)}</span>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-right text-sm text-muted-foreground">
            {data.items.length} item{data.items.length === 1 ? '' : 's'} &middot; total {formatCurrency(net)}
          </p>
        </>
      )}
    </div>
  );
}
