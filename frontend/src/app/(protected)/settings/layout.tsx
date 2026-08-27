'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/api';

const TABS = [
  { href: '/settings/api', label: 'Petpooja API' },
  { href: '/settings/sync', label: 'Sync Schedule' },
  { href: '/settings/users', label: 'Users' },
  { href: '/settings/roles', label: 'Roles' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/api-explorer', label: 'API Explorer' },
  { href: '/settings/predictions-import', label: 'Sales Forecast' },
];

// VIEWER gets read-only Petpooja API + API Explorer, but no Users/Roles/Notifications/
// Sync Schedule; every other non-admin role keeps the existing Notifications-only access.
const VIEWER_TABS = new Set(['/settings/api', '/settings/api-explorer']);

export function allowedSettingsTabsFor(role: Role | undefined): string[] {
  if (role === 'ADMIN') return TABS.map((t) => t.href);
  if (role === 'VIEWER') return TABS.filter((t) => VIEWER_TABS.has(t.href)).map((t) => t.href);
  return ['/settings/notifications'];
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const allowed = allowedSettingsTabsFor(user.role);
    if (!allowed.includes(pathname)) {
      router.replace(allowed[0]);
    }
  }, [user, pathname, router]);

  const allowedTabs = allowedSettingsTabsFor(user?.role);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.filter((tab) => allowedTabs.includes(tab.href)).map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              pathname === tab.href
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
