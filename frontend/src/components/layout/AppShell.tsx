'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ClosingReminderOverlay } from './ClosingReminderOverlay';
import { useSidebarStore } from '@/store/sidebarStore';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isHydrated } = useSidebarStore();
  const collapsed = isCollapsed && isHydrated;

  return (
    // h-dvh rather than h-screen: 100vh on mobile Safari includes the collapsing address bar.
    // The horizontal safe-area padding keeps content clear of the notch in landscape.
    <div className="flex h-dvh overflow-hidden pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <aside
        className={cn(
          'hidden shrink-0 border-r bg-background transition-all md:block',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
      {/* Covers whichever page outlet staff land on; renders nothing for other roles. */}
      <ClosingReminderOverlay />
    </div>
  );
}
