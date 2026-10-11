'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { useActivityLogFilters, useActivityLogs } from '@/hooks/useActivityLogs';
import { useOutlets } from '@/hooks/useOutlets';
import { useResettingPage } from '@/hooks/useResettingPage';
import { formatDate, formatTime } from '@/lib/format';
import type { ActivityLogRow } from '@/types/api';

const PAGE_SIZE = 20;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const FIELD_LABELS: Record<string, string> = {
  opening: 'Opening',
  actualClosing: 'Actual Closing',
};

// Action keys are namespaced by area ("reconciliation.entry.save"), so one prefix filters a
// whole part of the app — including actions added later, which a fixed list would miss.
const AREAS = [
  { value: 'all', label: 'All activity', prefix: '' },
  { value: 'reconciliation', label: 'Reconciliation', prefix: 'reconciliation.' },
  { value: 'class-a-items', label: 'Class A Items', prefix: 'class-a-items.' },
  { value: 'sold-out', label: 'Sold Out', prefix: 'sold-out.' },
  { value: 'wastage', label: 'Wastage', prefix: 'wastage.' },
  { value: 'predictions', label: 'Forecasts', prefix: 'predictions.' },
  { value: 'sync', label: 'Sync', prefix: 'sync.' },
  { value: 'settings', label: 'Settings & Users', prefix: 'settings.' },
  { value: 'auth', label: 'Sign-ins', prefix: 'auth.' },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'not set';
  return String(value);
}

export default function ActivityLogPage() {
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [area, setArea] = useState('all');
  const [action, setAction] = useState('all');
  const [userId, setUserId] = useState('all');
  const [outletId, setOutletId] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Any filter change puts the view back on page 1 — page 4 of the old result set is
  // meaningless against the new one.
  const actionPrefix = AREAS.find((a) => a.value === area)?.prefix ?? '';
  const [page, setPage] = useResettingPage(`${from}|${to}|${area}|${action}|${userId}|${outletId}|${search}`);
  const { data, isLoading, isError } = useActivityLogs(page, PAGE_SIZE, {
    from,
    to,
    action,
    actionPrefix,
    userId,
    outletId,
    search,
  });
  const { data: filters } = useActivityLogFilters();
  const { data: outlets } = useOutlets();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>
            Every change made through the app — who made it, when, and what moved. Views and failed
            attempts aren&apos;t recorded, and entries are kept for 90 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Two-up dates and full-width pickers on phones; from sm up it's the original wrapping row. */}
          <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="activity-from">From</Label>
              <Input id="activity-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-[150px]" />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="activity-to">To</Label>
              <Input id="activity-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-[150px]" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="activity-area">Area</Label>
              <Select
                value={area}
                onValueChange={(v) => {
                  setArea(v ?? 'all');
                  // A specific action from another area would win over the prefix and show
                  // nothing that matches the new choice, so reset it.
                  setAction('all');
                }}
              >
                <SelectTrigger id="activity-area" className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="activity-user">User</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v ?? 'all')}>
                <SelectTrigger id="activity-user" className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {filters?.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="activity-action">Action</Label>
              <Select value={action} onValueChange={(v) => setAction(v ?? 'all')}>
                <SelectTrigger id="activity-action" className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {filters?.actions.map((a) => (
                    <SelectItem key={a.action} value={a.action}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="activity-outlet">Outlet</Label>
              <Select value={outletId} onValueChange={(v) => setOutletId(v ?? 'all')}>
                <SelectTrigger id="activity-outlet" className="w-full sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outlets</SelectItem>
                  {outlets?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="activity-search">Search</Label>
              <Input
                id="activity-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())}
                placeholder="Item, email or URL"
                className="w-full sm:w-[200px]"
              />
            </div>
            <Button variant="outline" className="col-span-2" onClick={() => setSearch(searchInput.trim())}>
              Apply
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Failed to load the activity log.</p>
          ) : data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded for these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6" />
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>For date</TableHead>
                      <TableHead>Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <ActivityRow key={row.id} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination meta={data.meta} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityRow({ row }: { row: ActivityLogRow }) {
  const [open, setOpen] = useState(false);
  const changeEntries = Object.entries(row.changes ?? {});

  return (
    <>
      <TableRow>
        <TableCell className="pr-0">
          {/* Negative margin grows the tap target without shifting the row layout. */}
          <button
            type="button"
            className="-m-2 p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Show request details"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm">
          {formatDate(row.createdAt)}
          <span className="ml-1 text-muted-foreground">{formatTime(row.createdAt)}</span>
        </TableCell>
        <TableCell className="text-sm">
          <div>{row.userEmail}</div>
          {row.userRole && <div className="text-xs text-muted-foreground">{row.userRole}</div>}
        </TableCell>
        <TableCell className="text-sm">{row.label}</TableCell>
        <TableCell className="text-sm">
          {/* A brand-wide action (reordering rows, adding a Class A item) names the brand
              instead — it isn't tied to one outlet. */}
          {row.outletName ?? (row.brand ? <span className="text-muted-foreground">{row.brand} (all)</span> : '—')}
        </TableCell>
        <TableCell className="text-sm">{row.itemName ?? '—'}</TableCell>
        <TableCell className="whitespace-nowrap text-sm">
          {row.stockDate ? formatDate(row.stockDate) : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-sm">
          {changeEntries.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {changeEntries.map(([field, change]) => (
                <Badge key={field} variant="secondary" className="font-normal">
                  {FIELD_LABELS[field] ?? field}: {formatValue(change.from)} → {formatValue(change.to)}
                </Badge>
              ))}
            </div>
          )}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/40">
            <div className="space-y-1 text-xs">
              <p className="font-medium">
                {row.method} {row.path} · {row.statusCode}
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                {JSON.stringify(row.payload ?? {}, null, 2)}
              </pre>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
