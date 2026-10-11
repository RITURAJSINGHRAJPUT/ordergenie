import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    // Tighter padding and a smaller figure on phones: the grid stays two-up there, and a lakh-sized
    // ₹ amount at text-2xl would be clipped by the card's overflow-hidden.
    <Card className="min-w-0 [--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold tabular-nums break-words sm:text-2xl">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
