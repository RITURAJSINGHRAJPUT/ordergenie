'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useVisibleNav } from '@/hooks/useVisibleNav';

/**
 * A brand root (`/capiche`, `/aiko`) is not a page of its own — it forwards to the first
 * page of that brand the user is actually allowed to open. Overview for most roles, but
 * Reconciliation for a Head Chef, who can't see Overview at all.
 */
export function BrandIndexRedirect({ brand }: { brand: string }) {
  const router = useRouter();
  const { items, isReady } = useVisibleNav();

  useEffect(() => {
    if (!isReady) return;
    const children = items.find((item) => item.brand === brand)?.children ?? [];
    const target = children.find((child) => child.label === 'Overview') ?? children[0];
    router.replace(target?.href ?? '/dashboard');
  }, [isReady, items, brand, router]);

  return null;
}
