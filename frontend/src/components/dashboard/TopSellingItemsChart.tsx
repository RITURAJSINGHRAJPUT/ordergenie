'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact, formatCurrencyTooltip } from '@/lib/format';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { axisProps, tooltipProps, truncateTick } from './chart-theme';

export function TopSellingItemsChart({ data }: { data: { itemName: string; revenue: number }[] }) {
  const isMobile = useIsMobile();
  const top = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Selling Items (14d)</CardTitle>
      </CardHeader>
      <CardContent className="h-60 px-2 sm:px-4 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ left: isMobile ? 0 : 24, right: isMobile ? 8 : 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => (isMobile ? formatCurrencyCompact(v) : formatCurrency(v))}
              fontSize={isMobile ? 11 : 12}
              {...axisProps}
            />
            <YAxis
              type="category"
              dataKey="itemName"
              width={isMobile ? 92 : 140}
              fontSize={11}
              tickLine={false}
              tickFormatter={isMobile ? truncateTick(14) : undefined}
              {...axisProps}
            />
            <Tooltip formatter={formatCurrencyTooltip} {...tooltipProps} />
            <Bar dataKey="revenue" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
