'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrencyTooltip } from '@/lib/format';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { CHART_COLORS, tooltipProps } from './chart-theme';

export function PaymentBreakdownChart({ data }: { data: { paymentMode: string; amount: number }[] }) {
  const isMobile = useIsMobile();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Breakdown (Month)</CardTitle>
      </CardHeader>
      <CardContent className="h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="paymentMode"
              innerRadius={isMobile ? 40 : 50}
              outerRadius={isMobile ? 72 : 90}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatCurrencyTooltip} {...tooltipProps} />
            <Legend wrapperStyle={isMobile ? { fontSize: 12 } : undefined} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
