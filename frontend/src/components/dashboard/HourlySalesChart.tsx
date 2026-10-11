'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact, formatCurrencyTooltip } from '@/lib/format';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { axisProps, tooltipProps } from './chart-theme';

export function HourlySalesChart({ data }: { data: { hour: number; amount: number }[] }) {
  const isMobile = useIsMobile();
  const formatted = data.map((d) => ({ ...d, label: `${d.hour}:00` }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hourly Sales (Today)</CardTitle>
      </CardHeader>
      <CardContent className="h-60 px-2 sm:px-4 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" fontSize={11} tickLine={false} interval={isMobile ? 5 : 2} {...axisProps} />
            <YAxis
              tickFormatter={(v) => (isMobile ? formatCurrencyCompact(v) : formatCurrency(v))}
              fontSize={isMobile ? 11 : 12}
              width={isMobile ? 48 : 70}
              {...axisProps}
            />
            <Tooltip formatter={formatCurrencyTooltip} {...tooltipProps} />
            <Bar dataKey="amount" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
