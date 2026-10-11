'use client';

import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { useSyncSchedules, useUpdateSyncSchedule } from '@/hooks/useSettings';
import { useSyncLogs, useTriggerManualSync } from '@/hooks/useSync';
import { usePagedList } from '@/hooks/usePagedList';
import { formatDate, formatTime } from '@/lib/format';
import type { SyncLogRow } from '@/types/api';

const STATUS_VARIANT: Record<SyncLogRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RUNNING: 'outline',
  SUCCESS: 'secondary',
  PARTIAL: 'default',
  FAILED: 'destructive',
};

export default function SyncSchedulePage() {
  const { data, isLoading, isError } = useSyncSchedules();
  const update = useUpdateSyncSchedule();
  const triggerSync = useTriggerManualSync();
  const { data: logs } = useSyncLogs();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { pageItems: logsPage, meta: logsMeta, setPage: setLogsPage } = usePagedList(logs);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Failed to load sync schedule.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sync Type</TableHead>
                <TableHead>Cron Expression</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.syncType}</TableCell>
                  <TableCell>
                    <Input
                      className="w-[160px] font-mono text-base md:text-xs"
                      value={drafts[s.syncType] ?? s.cronExpression}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.syncType]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell>
                    {s.lastRunAt ? `${formatDate(s.lastRunAt)} ${formatTime(s.lastRunAt)}` : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.isEnabled}
                      onCheckedChange={(checked) => update.mutate({ syncType: s.syncType, isEnabled: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Flex lives on an inner div: a flex <td> stops being a table cell and
                        breaks the row's column alignment. */}
                    <div className="flex items-center gap-3">
                      <button
                        className="py-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50 md:py-0.5"
                        disabled={!drafts[s.syncType] || drafts[s.syncType] === s.cronExpression}
                        onClick={() => update.mutate({ syncType: s.syncType, cronExpression: drafts[s.syncType] })}
                      >
                        Save
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={triggerSync.isPending}
                        onClick={() => triggerSync.mutate(s.syncType)}
                      >
                        <PlayCircle className="mr-1 h-3.5 w-3.5" />
                        Run Now
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Fetched</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsPage.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.syncType}</TableCell>
                  <TableCell>{l.triggerType}</TableCell>
                  <TableCell>{l.outletName ?? 'All'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[l.status]} title={l.errorMessage ?? undefined}>
                      {l.status}
                    </Badge>
                    {/* The title tooltip needs hover, so phones and touch screens get the error inline. */}
                    {l.errorMessage && (
                      <p className="mt-1 max-w-[16rem] whitespace-normal break-words text-xs text-destructive md:hidden pointer-coarse:block">
                        {l.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{l.recordsFetched}</TableCell>
                  <TableCell className="text-right">{l.recordsCreated}</TableCell>
                  <TableCell className="text-right">{l.recordsUpdated}</TableCell>
                  <TableCell>{formatDate(l.startedAt)} {formatTime(l.startedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination meta={logsMeta} onPageChange={setLogsPage} />
        </CardContent>
      </Card>
    </div>
  );
}
