'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AppShell } from '@/components/layout/AppShell';
import { useVisibleNav } from '@/hooks/useVisibleNav';
import { isRouteAllowed } from '@/components/layout/nav-items';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isHydrated } = useAuthStore();
  const { items, isReady } = useVisibleNav();

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace('/login');
    }
  }, [isHydrated, token, router]);

  // Hiding a nav item isn't access control on its own — a Capiche head chef could still
  // type /aiko/sold-out. Same allowlist that builds the nav decides what's reachable.
  useEffect(() => {
    if (!token || !isReady) return;
    if (!isRouteAllowed(pathname, items)) {
      router.replace('/dashboard');
    }
  }, [token, isReady, items, pathname, router]);

  if (!isHydrated || !token) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
