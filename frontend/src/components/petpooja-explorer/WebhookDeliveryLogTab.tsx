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
import { WebhookLogDetailDialog } from '@/components/petpooja-explorer/WebhookLogDetailDialog';
import { usePurchaseOrderWebhookLogs } from '@/hooks/usePurchaseOrderWebhookLogs';
import { useResettingPage } from '@/hooks/useResettingPage';
import { useOutlets } from '@/hooks/useOutlets';
import { useFilterStore } from '@/store/filterStore';
import { formatDate, formatTime } from '@/lib/format';
import type { WebhookOutcome } from '@/types/api';

const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Outcomes' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function WebhookDeliveryLogTab() {
  const { outletId, customFrom, customTo, setOutletId } = useFilterStore();
  const { data: outlets } = useOutlets();
  const [outcome, setOutcome] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useResettingPage(`${outcome}|${outletId}|${customFrom}|${customTo}|${search}`);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = usePurchaseOrderWebhookLogs(page, 12, {
    outcome,
    search: search || undefined,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every inbound call to <code className="text-xs">/api/webhooks/petpooja/purchase-order</code>, success or
        rejected, in the order it was received — including deliveries that never made it into a Purchase Order row
        (unresolved outlet, malformed payload, bad credentials). Use this to tell apart &quot;Petpooja never sent
        it&quot; from &quot;we rejected it&quot;.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Search PO number / Petpooja ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[220px]"
          />
          <Select value={outletId} onValueChange={(v) => setOutletId(v ?? 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outlets</SelectItem>
              <SelectItem value="unresolved">Unresolved / No Outlet</SelectItem>
              {(outlets ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={(v) => setOutcome(v ?? 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Delivery Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Failed to load webhook delivery log.</p>
          ) : data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhook deliveries recorded in this date range.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Received</TableHead>
                      <TableHead>PO #</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelectedId(log.id)}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(log.receivedAt)} {formatTime(log.receivedAt)}
                        </TableCell>
                        <TableCell className="font-medium">{log.poNumber ?? '—'}</TableCell>
                        <TableCell>{log.outletName ?? <span className="text-muted-foreground">Unresolved</span>}</TableCell>
                        <TableCell>
                          <Badge variant={outcomeVariant(log.outcome)}>{log.outcome}</Badge>
                        </TableCell>
                        <TableCell>{log.status ? log.status.replace('_', ' ') : '—'}</TableCell>
                        <TableCell>{log.httpStatusCode}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-muted-foreground">
                          {log.failureReason ?? '—'}
                        </TableCell>
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

      <WebhookLogDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function outcomeVariant(outcome: WebhookOutcome): 'default' | 'secondary' | 'destructive' | 'outline' {
  return outcome === 'SUCCESS' ? 'secondary' : 'destructive';
}
