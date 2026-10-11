'use client';

import { ChevronDown, ChevronRight, Download, FileJson } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/shared/Pagination';
import { usePagedList } from '@/hooks/usePagedList';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { ExplorerOrderRecord, ExplorerPurchaseRecord, ExplorerResult, ExplorerTransferRecord } from '@/types/api';

export function ExplorerResults({
  result,
  expanded,
  setExpanded,
  onExportCsv,
  onExportJson,
}: {
  result: ExplorerResult;
  expanded: Set<number>;
  setExpanded: (s: Set<number>) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}) {
  function toggleRow(i: number) {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpanded(next);
  }

  // A live Petpooja pull can return records across a whole date range x every outlet —
  // this can be a lot of rows, so it's paginated client-side same as the other spots
  // with no backend page support. `start` lets row index (used for expand-state + CSV/JSON
  // export ordering) stay tied to the record's position in the FULL result.records array,
  // not its position within the current page slice.
  // `records` is widened to the common union — result.records' actual type (a union OF
  // array types, not an array of the union) doesn't infer cleanly against usePagedList<T>.
  const records: (ExplorerOrderRecord | ExplorerPurchaseRecord | ExplorerTransferRecord)[] = result.records;
  const { meta, setPage } = usePagedList(records, 12);
  const start = (meta.page - 1) * meta.pageSize;
  const pageRecords = records.slice(start, start + meta.pageSize);
  const erroredOutlets = result.perOutlet.filter((o) => o.error);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Records" value={formatNumber(result.recordCount)} />
        <StatCard label="Outlets with data" value={`${result.outletsWithData}/${result.outletsRequested}`} />
        <StatCard label="API calls" value={formatNumber(result.apiCallCount)} />
        <StatCard label="Elapsed" value={`${(result.elapsedMs / 1000).toFixed(1)}s`} />
        <StatCard label="Total value" value={formatCurrency(result.totalValue)} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {result.perOutlet.map((o) => (
            <Badge key={o.outletId} variant={o.error ? 'destructive' : o.count > 0 ? 'secondary' : 'outline'} title={o.error}>
              {o.outletName}: {o.error ? 'error' : o.count}
            </Badge>
          ))}
        </div>
        {/* Each badge's error is a hover tooltip, so phones and touch screens get them listed inline. */}
        {erroredOutlets.length > 0 && (
          <ul className="space-y-1 text-xs text-destructive md:hidden pointer-coarse:block">
            {erroredOutlets.map((o) => (
              <li key={o.outletId} className="break-words">
                <span className="font-medium">{o.outletName}:</span> {o.error}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm">Records</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExportCsv} disabled={result.records.length === 0}>
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportJson}>
              <FileJson className="mr-1 h-4 w-4" />
              JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {result.records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records returned.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                {result.apiType === 'orders' && (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead />
                        <TableHead>Outlet</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(pageRecords as ExplorerOrderRecord[]).map((r, localI) => {
                        const i = start + localI;
                        return <OrderRows key={i} row={r} index={i} expanded={expanded.has(i)} onToggle={() => toggleRow(i)} />;
                      })}
                    </TableBody>
                  </>
                )}
                {result.apiType === 'purchase' && (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead />
                        <TableHead>Outlet</TableHead>
                        <TableHead>Purchase ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(pageRecords as ExplorerPurchaseRecord[]).map((r, localI) => {
                        const i = start + localI;
                        return <PurchaseRows key={i} row={r} index={i} expanded={expanded.has(i)} onToggle={() => toggleRow(i)} />;
                      })}
                    </TableBody>
                  </>
                )}
                {result.apiType === 'transfer' && (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Outlet</TableHead>
                        <TableHead>Raw Record</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(pageRecords as ExplorerTransferRecord[]).map((r, localI) => (
                        <TableRow key={start + localI}>
                          <TableCell>{r.outletName}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {/* Cells default to nowrap, which would stretch this one-line JSON into a
                                table many screens wide. The cap sits on a div because max-width
                                on a <td> isn't reliably honoured. */}
                            <div className="min-w-[12rem] max-w-[24rem] whitespace-pre-wrap break-all">{JSON.stringify(r.raw)}</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 min-w-0 text-lg font-semibold tabular-nums break-words sm:text-xl">{value}</div>
      </CardContent>
    </Card>
  );
}

export function OrderRows({
  row,
  index,
  expanded,
  onToggle,
}: {
  row: ExplorerOrderRecord;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow key={index} className="cursor-pointer" onClick={onToggle}>
        <TableCell>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
        <TableCell>{row.outletName}</TableCell>
        <TableCell className="font-medium">{row.orderId}</TableCell>
        <TableCell>{row.date}</TableCell>
        <TableCell>{row.orderType ?? '—'}</TableCell>
        <TableCell>{row.paymentType ?? '—'}</TableCell>
        <TableCell>{row.status ?? '—'}</TableCell>
        <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
        <TableCell className="text-right">{row.items.length}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30">
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
                  {row.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.discount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function PurchaseRows({
  row,
  index,
  expanded,
  onToggle,
}: {
  row: ExplorerPurchaseRecord;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow key={index} className="cursor-pointer" onClick={onToggle}>
        <TableCell>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
        <TableCell>{row.outletName}</TableCell>
        <TableCell className="font-medium">{row.purchaseId}</TableCell>
        <TableCell>{row.type ?? '—'}</TableCell>
        <TableCell>{row.invoiceNumber ?? '—'}</TableCell>
        <TableCell>{row.invoiceDate ?? '—'}</TableCell>
        <TableCell>{row.supplierName ?? '—'}</TableCell>
        <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
        <TableCell>{row.payment ?? '—'}</TableCell>
        <TableCell>{row.status ?? '—'}</TableCell>
        <TableCell className="text-right">{row.items.length}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/30">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell>{item.unit ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.discount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
