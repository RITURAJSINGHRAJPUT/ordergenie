'use client';

import { IndianRupee, Percent, Receipt, Boxes, ClipboardList, AlertTriangle, TrendingUp } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { OutletComparisonChart } from '@/components/dashboard/OutletComparisonChart';
import { TopSellingItemsChart } from '@/components/dashboard/TopSellingItemsChart';
import { HourlySalesChart } from '@/components/dashboard/HourlySalesChart';
import { PaymentBreakdownChart } from '@/components/dashboard/PaymentBreakdownChart';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/format';

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Failed to load dashboard data.</p>;
  }

  const { kpis, charts } = data;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <KpiCard label="Today's Sales" value={formatCurrency(kpis.todaySales)} icon={IndianRupee} hint={`${formatNumber(kpis.todayOrders)} orders`} />
        <KpiCard label="Yesterday Sales" value={formatCurrency(kpis.yesterdaySales)} icon={TrendingUp} />
        <KpiCard label="Monthly Sales" value={formatCurrency(kpis.monthlySales)} icon={IndianRupee} hint={`${formatNumber(kpis.monthlyOrders)} orders`} />
        <KpiCard label="Average Bill" value={formatCurrency(kpis.averageBill)} icon={Receipt} />
        <KpiCard label="Discounts" value={formatCurrency(kpis.discounts)} icon={Percent} />
        <KpiCard label="Taxes" value={formatCurrency(kpis.taxes)} icon={Percent} />
        <KpiCard label="Inventory Value" value={formatCurrency(kpis.inventoryValue)} icon={Boxes} />
        <KpiCard label="Purchase Orders" value={formatNumber(kpis.purchaseOrders)} icon={ClipboardList} hint="Open / pending" />
      </div>

      {kpis.lowStockItems > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {kpis.lowStockItems} item{kpis.lowStockItems === 1 ? '' : 's'} running low on stock across outlets.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesTrendChart data={charts.salesTrend} />
        <OutletComparisonChart data={charts.outletComparison} />
        <TopSellingItemsChart data={charts.topSellingItems} />
        <HourlySalesChart data={charts.hourlySales} />
        <PaymentBreakdownChart data={charts.paymentBreakdown} />
      </div>
    </div>
  );
}
