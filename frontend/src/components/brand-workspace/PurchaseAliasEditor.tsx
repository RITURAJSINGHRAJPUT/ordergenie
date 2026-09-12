'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePurchaseAliasSuggestions, useSetPurchaseAliases } from '@/hooks/useClassAItems';
import { cn } from '@/lib/utils';

/**
 * Links a reconciliation row to the purchase-order names that belong to it.
 *
 * Sold and purchased names never match in Petpooja data — "Coke" is sold while "Coke 300 Ml"
 * is purchased — so without a link the PO column sits at zero. Keyed by item name, which is
 * why it works for rows that expanded out of a CATEGORY entry as well as plain items.
 */
export function PurchaseAliasEditor({
  brand,
  itemName,
  current,
  onClose,
}: {
  brand: string;
  itemName: string;
  current: string[];
  onClose: () => void;
}) {
  const { data: suggestions, isLoading } = usePurchaseAliasSuggestions(brand, itemName);
  const save = useSetPurchaseAliases();
  const [selected, setSelected] = useState<string[]>(current);

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const options = [...new Set([...selected, ...(suggestions ?? [])])];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Purchase names for &ldquo;{itemName}&rdquo;</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Purchase orders often spell an item differently from the menu. Tick the PO names that belong to this item so
          their quantities count toward its PO column.
        </p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchase-order items resemble this name.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {options.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  selected.includes(name) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate({ brand, itemName, purchaseAliases: selected }, { onSuccess: onClose })}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
