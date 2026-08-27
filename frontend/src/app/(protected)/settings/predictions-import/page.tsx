'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { usePredictionSummary, usePredictionImportLogs, useImportPredictionWorkbook } from '@/hooks/usePredictedSalesImport';
import { useResettingPage } from '@/hooks/useResettingPage';
import { formatDate, formatTime } from '@/lib/format';
import type { PredictionImportLogRow } from '@/types/api';

const STATUS_VARIANT: Record<PredictionImportLogRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RUNNING: 'outline',
  SUCCESS: 'secondary',
  PARTIAL: 'default',
  FAILED: 'destructive',
};

export default function PredictionsImportPage() {
  const { data: summary, isLoading: summaryLoading } = usePredictionSummary();
  const [page, setPage] = useResettingPage('predictions-import');
  const { data: logs, isLoading: logsLoading } = usePredictionImportLogs(page);
  const importMutation = useImportPredictionWorkbook();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleUpload() {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile, {
      onSettled: () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
    });
  }

  const lastResult = importMutation.data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a monthly sales-forecast workbook (e.g. <code className="text-xs">Aug_2026_Final_Prediction_v14.xlsx</code>)
        to power the &quot;Sales (AI)&quot; predictions used in reconciliation and the Predictions tabs. Re-uploading the
        same or a later file safely refreshes existing rows rather than duplicating them.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currently Loaded</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !summary || summary.totalRows === 0 ? (
            <p className="text-sm text-muted-foreground">No prediction data loaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">Total Rows</div>
                <div className="font-medium">{summary.totalRows.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Covers</div>
                <div className="font-medium">
                  {summary.minStockDate ? formatDate(summary.minStockDate) : '—'} –{' '}
                  {summary.maxStockDate ? formatDate(summary.maxStockDate) : '—'}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-muted-foreground">Source File(s)</div>
                <div className="font-medium">{summary.sources.join(', ') || '—'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
            />
            <Button disabled={!selectedFile || importMutation.isPending} onClick={handleUpload}>
              <UploadCloud className="mr-1 h-4 w-4" />
              {importMutation.isPending ? 'Uploading…' : 'Upload & Import'}
            </Button>
          </div>

          {lastResult && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[lastResult.status]}>{lastResult.status}</Badge>
                <span>
                  {lastResult.rowsCreated} created, {lastResult.rowsUpdated} updated across {lastResult.sheetsProcessed} sheet(s)
                </span>
              </div>
              {lastResult.errorMessage && <p className="mt-2 text-destructive">{lastResult.errorMessage}</p>}
              {lastResult.sheetsSkipped.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {lastResult.sheetsSkipped.map((s) => (
                    <li key={s.sheet}>
                      <span className="font-medium">{s.sheet}</span>: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !logs || logs.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead>Sheets Skipped</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Uploaded By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.rows.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.fileName}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[l.status]} title={l.errorMessage ?? undefined}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{l.rowsCreated}</TableCell>
                        <TableCell className="text-right">{l.rowsUpdated}</TableCell>
                        <TableCell>{l.sheetsSkipped.length > 0 ? l.sheetsSkipped.length : '—'}</TableCell>
                        <TableCell>
                          {formatDate(l.startedAt)} {formatTime(l.startedAt)}
                        </TableCell>
                        <TableCell>{l.triggeredByName ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination meta={logs.meta} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
