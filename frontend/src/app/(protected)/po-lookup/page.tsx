'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePoLookup, usePoLookupPdfDownload } from '@/hooks/usePoLookup';
import { formatDate, formatNumber } from '@/lib/format';
import type { PoLookupCity } from '@/types/api';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PoLookupPage() {
  // Prep is done the day before delivery, so tomorrow is the day someone opens this for.
  const [date, setDate] = useState(tomorrowIso());
  const { data, isLoading, isError } = usePoLookup(date);
  const downloadPdf = usePoLookupPdfDownload();
  const hasRows = (data ?? []).some((city) => city.rows.length > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PO Lookup</CardTitle>
          <CardDescription>
            Everything the restaurants in each city have on order for one day, totalled per item — what the prep
            kitchen has to produce. Counts purchase orders due on the date chosen, falling back to the order date
            for the ones raised without a delivery date. Cancelled orders are left out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="po-lookup-date">Delivery date</Label>
              <Input
                id="po-lookup-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" disabled={!hasRows || downloadPdf.isPending} />}
              >
                <Download className="mr-1 h-4 w-4" />
                {downloadPdf.isPending ? 'Preparing…' : 'Download PDF'}
              </DropdownMenuTrigger>
              {/* Driven by the day's cities rather than a fixed Surat/Ahmedabad list, so a new
                  city appears here the moment an outlet is opened there. */}
              <DropdownMenuContent align="start" className="min-w-44">
                {(data ?? [])
                  .filter((city) => city.rows.length > 0)
                  .map((city) => (
                    <DropdownMenuItem key={city.city} onClick={() => downloadPdf.mutate({ date, city: city.city })}>
                      {city.city} only
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuItem onClick={() => downloadPdf.mutate({ date })}>All cities</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError || !data ? (
        <p className="text-sm text-destructive">Failed to load purchase orders.</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outlets are set up for this view yet.</p>
      ) : (
        data.map((city) => <CityCard key={city.city} city={city} date={date} />)
      )}
    </div>
  );
}

function CityCard({ city, date }: { city: PoLookupCity; date: string }) {
  const total = city.rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {city.city} · {formatDate(date)}
        </CardTitle>
        <CardDescription>
          {city.outlets.map((o) => o.name).join(' · ')}
          {city.rows.length > 0 && ` — ${city.rows.length} items, ${formatNumber(total)} units in total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {city.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase orders due on this date.</p>
        ) : (
          <>
            {/* Tablet and up: outlets across the top, one row per item. */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    {city.outlets.map((outlet) => (
                      <TableHead key={outlet.id} className="text-center">
                        {outlet.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {city.rows.map((row) => (
                    <TableRow key={`${row.itemName}|${row.unit ?? ''}`}>
                      <TableCell className="font-medium">{row.itemName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.unit ?? '—'}</TableCell>
                      {city.outlets.map((outlet) => (
                        <TableCell key={outlet.id} className="text-center">
                          {row.byOutlet[outlet.id] ? (
                            formatNumber(row.byOutlet[outlet.id])
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-semibold">{formatNumber(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: a card per item, since a column per outlet doesn't fit. */}
            <div className="space-y-2 md:hidden">
              {city.rows.map((row) => (
                <div key={`${row.itemName}|${row.unit ?? ''}`} className="rounded-md border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{row.itemName}</span>
                    <span className="text-sm font-semibold">
                      {formatNumber(row.total)} {row.unit ?? ''}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {city.outlets
                      .filter((outlet) => row.byOutlet[outlet.id])
                      .map((outlet) => `${outlet.name}: ${formatNumber(row.byOutlet[outlet.id])}`)
                      .join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
