'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Bar, BarChart } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useItemDetail } from '@/hooks/useItemDetail';
import { formatCurrency, formatDate, formatCurrencyTooltip, formatDateTooltip } from '@/lib/format';
import { axisProps, tooltipProps } from '@/components/dashboard/chart-theme';

export function ItemDetailDialog({ itemName, onClose }: { itemName: string | null; onClose: () => void }) {
  const { data, isLoading } = useItemDetail(itemName);

  return (
    <Dialog open={Boolean(itemName)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{itemName}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Daily Trend (90d)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} fontSize={11} {...axisProps} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} fontSize={11} width={70} {...axisProps} />
                    <Tooltip formatter={formatCurrencyTooltip} labelFormatter={formatDateTooltip} {...tooltipProps} />
                    <Line type="monotone" dataKey="amount" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Peak Selling Hours</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.peakHours.map((h) => ({ ...h, label: `${h.hour}:00` }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" fontSize={10} interval={2} {...axisProps} />
                    <YAxis fontSize={11} width={40} {...axisProps} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="quantity" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Outlet Comparison</h3>
              <div className="space-y-1 text-sm">
                {data.outletComparison
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((o) => (
                    <div key={o.outletId} className="flex justify-between border-b py-1 last:border-0">
                      <span>{o.outletName}</span>
                      <span className="font-medium">{formatCurrency(o.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
