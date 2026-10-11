'use client';

import { FileSpreadsheet, FileText, FileJson } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useReportDownload } from '@/hooks/useReportDownload';

const REPORTS = [
  { type: 'sales', title: 'Sales', description: 'All transactions with gross, discount, tax, and net breakdown.' },
  { type: 'item-sales', title: 'Item Sales', description: 'Item-wise quantity sold, revenue, and average price.' },
  { type: 'inventory', title: 'Inventory', description: 'Current stock levels, stock value, and low-stock flags.' },
  { type: 'purchase-orders', title: 'Purchase Orders', description: 'PO list with vendor, status, and amounts.' },
  { type: 'outlet-comparison', title: 'Outlet Comparison', description: 'Revenue, orders, average bill, and growth by outlet.' },
  { type: 'tax-summary', title: 'Tax Summary', description: 'Sales tax collected vs. purchase GST paid, by outlet.' },
];

export default function ReportsPage() {
  const download = useReportDownload();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.type}>
            <CardHeader>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={download.isPending}
                onClick={() => download.mutate({ type: r.type, format: 'csv' })}
              >
                <FileJson className="mr-1 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={download.isPending}
                onClick={() => download.mutate({ type: r.type, format: 'excel' })}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={download.isPending}
                onClick={() => download.mutate({ type: r.type, format: 'pdf' })}
              >
                <FileText className="mr-1 h-4 w-4" />
                PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
