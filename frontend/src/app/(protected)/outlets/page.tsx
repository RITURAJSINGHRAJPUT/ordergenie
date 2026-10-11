'use client';

import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import { MobileCard, MobileCardList, MobileField, MobileFields } from '@/components/shared/MobileCard';
import { useOutletsOverview, useOutletComparison } from '@/hooks/useOutletsOverview';
import { usePagedList } from '@/hooks/usePagedList';
import { formatCurrency, formatNumber } from '@/lib/format';

export default function OutletsPage() {
  const [tab, setTab] = useState('list');
  const { data: overview, isLoading: loadingOverview, isError: overviewError } = useOutletsOverview();
  const { data: comparison, isLoading: loadingComparison, isError: comparisonError } = useOutletComparison();

  const { pageItems: overviewPage, meta: overviewMeta, setPage: setOverviewPage } = usePagedList(overview);

  const sortedComparison = useMemo(
    () => (comparison ? [...comparison].sort((a, b) => b.revenue - a.revenue) : undefined),
    [comparison]
  );
  const { pageItems: comparisonPage, meta: comparisonMeta, setPage: setComparisonPage } = usePagedList(sortedComparison);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Outlets</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">Outlet List</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : overviewError || !overview ? (
                <p className="text-sm text-destructive">Failed to load outlets.</p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Outlet</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Today&apos;s Sales</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Inventory Value</TableHead>
                          <TableHead className="text-right">Open POs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overviewPage.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">
                              {o.name}
                              {o.city && <span className="ml-1 text-xs text-muted-foreground">({o.city})</span>}
                            </TableCell>
                            <TableCell>{o.brand}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{o.outletType.replace('_', ' ')}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(o.todaySales)}</TableCell>
                            <TableCell className="text-right">{formatNumber(o.todayOrders)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(o.inventoryValue)}</TableCell>
                            <TableCell className="text-right">{formatNumber(o.openPurchaseOrders)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <MobileCardList>
                    {overviewPage.map((o) => (
                      <MobileCard
                        key={o.id}
                        title={o.name}
                        subtitle={o.city ? `${o.brand} · ${o.city}` : o.brand}
                        aside={<Badge variant="outline">{o.outletType.replace('_', ' ')}</Badge>}
                      >
                        <MobileFields>
                          <MobileField label="Today's Sales">{formatCurrency(o.todaySales)}</MobileField>
                          <MobileField label="Orders">{formatNumber(o.todayOrders)}</MobileField>
                          <MobileField label="Inventory Value">{formatCurrency(o.inventoryValue)}</MobileField>
                          <MobileField label="Open POs">{formatNumber(o.openPurchaseOrders)}</MobileField>
                        </MobileFields>
                      </MobileCard>
                    ))}
                  </MobileCardList>
                  <Pagination meta={overviewMeta} onPageChange={setOverviewPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outlet Comparison</CardTitle>
              <CardDescription>Uses the selected date range. Not affected by the outlet filter — this view always compares across all outlets.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingComparison ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : comparisonError || !comparison ? (
                <p className="text-sm text-destructive">Failed to load outlet comparison.</p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Outlet</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Orders</TableHead>
                          <TableHead className="text-right">Avg Bill</TableHead>
                          <TableHead className="text-right">Growth</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonPage.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">{o.name}</TableCell>
                            <TableCell>{o.brand}</TableCell>
                            <TableCell className="text-right">{formatCurrency(o.revenue)}</TableCell>
                            <TableCell className="text-right">{formatNumber(o.orders)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(o.averageBill)}</TableCell>
                            <TableCell className="text-right">
                              {o.growthPercent === null ? (
                                '—'
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 ${
                                    o.growthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {o.growthPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                  {Math.abs(o.growthPercent).toFixed(1)}%
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <MobileCardList>
                    {comparisonPage.map((o) => (
                      <MobileCard
                        key={o.id}
                        title={o.name}
                        subtitle={o.brand}
                        aside={
                          <>
                            <div className="font-semibold">{formatCurrency(o.revenue)}</div>
                            {o.growthPercent !== null && (
                              <span
                                className={`inline-flex items-center gap-1 text-xs ${
                                  o.growthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {o.growthPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                {Math.abs(o.growthPercent).toFixed(1)}%
                              </span>
                            )}
                          </>
                        }
                      >
                        <MobileFields>
                          <MobileField label="Orders">{formatNumber(o.orders)}</MobileField>
                          <MobileField label="Avg Bill">{formatCurrency(o.averageBill)}</MobileField>
                        </MobileFields>
                      </MobileCard>
                    ))}
                  </MobileCardList>
                  <Pagination meta={comparisonMeta} onPageChange={setComparisonPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
