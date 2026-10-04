'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Placeholder for the calculated-items page: items nothing sells directly, whose usage is worked
 * out from the dishes that do (so many grams of mozzarella per pizza). Empty until the rules
 * behind it are agreed.
 */
export function BrandClassBItemsTab({ brand }: { brand: string; outletId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Class B Items — {brand}</CardTitle>
        <CardDescription>
          Formula-based items: ingredients that aren&apos;t sold on their own, whose usage is calculated from the
          items that are.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      </CardContent>
    </Card>
  );
}
