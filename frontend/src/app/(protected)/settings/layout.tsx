'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { SALES_FORECAST_GRANT, type Role } from '@/types/api';

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
const SALES_FORECAST_TAB = '/settings/predictions-import';

/**
 * Settings is SUPER_ADMIN-only. A plain ADMIN gets nothing here unless they hold a page
 * grant, in which case they get exactly that one tab — the grant opens a page, not the section.
 */
export function allowedSettingsTabsFor(user: { role?: Role; pageGrants?: string[] } | undefined): string[] {
  if (!user?.role) return [];
  if (user.role === 'SUPER_ADMIN') return TABS.map((t) => t.href);
  if (user.pageGrants?.includes(SALES_FORECAST_GRANT)) return [SALES_FORECAST_TAB];
  if (user.role === 'VIEWER') return TABS.filter((t) => VIEWER_TABS.has(t.href)).map((t) => t.href);
  if (user.role === 'ADMIN') return [];
  return ['/settings/notifications'];
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const allowed = allowedSettingsTabsFor(user);
    if (!allowed.includes(pathname)) {
      // An ADMIN with no grant has no reachable tab at all, so there's nothing to fall back to.
      router.replace(allowed[0] ?? '/dashboard');
    }
  }, [user, pathname, router]);

  const allowedTabs = allowedSettingsTabsFor(user ?? undefined);

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
