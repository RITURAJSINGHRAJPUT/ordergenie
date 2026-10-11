'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateShort,
  formatCurrencyTooltip,
  formatDateTooltip,
} from '@/lib/format';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { axisProps, tooltipProps } from './chart-theme';

export function SalesTrendChart({ data }: { data: { date: string; amount: number }[] }) {
  const isMobile = useIsMobile();
  return (
    // lg: only — a bare col-span-2 adds an implicit second column to the one-column phone grid.
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Sales Trend</CardTitle>
      </CardHeader>
      <CardContent className="h-60 px-2 sm:px-4 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => (isMobile ? formatDateShort(v) : formatDate(v))}
              fontSize={isMobile ? 11 : 12}
              tickLine={false}
              minTickGap={isMobile ? 12 : 5}
              {...axisProps}
            />
            <YAxis
              tickFormatter={(v) => (isMobile ? formatCurrencyCompact(v) : formatCurrency(v))}
              fontSize={isMobile ? 11 : 12}
              tickLine={false}
              width={isMobile ? 52 : 80}
              {...axisProps}
            />
            <Tooltip formatter={formatCurrencyTooltip} labelFormatter={formatDateTooltip} {...tooltipProps} />
            <Line type="monotone" dataKey="amount" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
