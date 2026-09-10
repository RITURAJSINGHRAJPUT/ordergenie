'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { allowedSettingsTabsFor } from './layout';

export default function SettingsIndexPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // No reachable tab (a plain ADMIN) means Settings isn't theirs to open at all.
    router.replace(allowedSettingsTabsFor(user ?? undefined)[0] ?? '/dashboard');
  }, [user, router]);

  return null;
}
