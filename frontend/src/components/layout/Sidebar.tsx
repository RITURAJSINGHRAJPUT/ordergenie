'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, PanelLeft, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type NavItem } from './nav-items';
import { useVisibleNav } from '@/hooks/useVisibleNav';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useRouter } from 'next/navigation';

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const toggleCollapsed = useSidebarStore((s) => s.toggle);

  const { items } = useVisibleNav();

  const [manualToggle, setManualToggle] = useState<Record<string, boolean>>({});

  function defaultOpen(item: NavItem): boolean {
    return item.children?.some((child) => child.href && isLinkActive(pathname, child.href)) ?? false;
  }

  function isOpen(item: NavItem): boolean {
    return manualToggle[item.label] ?? defaultOpen(item);
  }

  function toggleSection(item: NavItem) {
    setManualToggle((prev) => ({ ...prev, [item.label]: !isOpen(item) }));
  }

  /** Collapsed sidebar has no room for a children list — clicking a section
   * expands the whole sidebar back out and opens that section, rather than
   * building a separate flyout-menu affordance. */
  function openSectionAndExpand(item: NavItem) {
    setManualToggle((prev) => ({ ...prev, [item.label]: true }));
    toggleCollapsed();
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-6')}>
        {!collapsed && (
          <span className="flex items-center gap-2">
            <img src="/brand/logo-mark.png" alt="" className="h-7 w-7 rounded-md" />
            <span className="text-lg font-semibold tracking-tight">OrderGenie</span>
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className={cn('flex-1 min-h-0 overflow-y-auto space-y-1', collapsed ? 'px-2' : 'px-3')}>
        {items.map((item) => {
          if (item.children) {
            const SectionIcon = item.icon;

            if (collapsed) {
              return (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  onClick={() => openSectionAndExpand(item)}
                  className="flex w-full items-center justify-center rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <SectionIcon className="h-4 w-4" />
                </button>
              );
            }

            const open = isOpen(item);
            const children = item.children;
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleSection(item)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
                </button>
                {open && (
                  <div className="mt-1 ml-3 space-y-1 border-l pl-2">
                    {children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = child.href ? isLinkActive(pathname, child.href) : false;
                      return (
                        <Link
                          key={child.href}
                          href={child.href ?? '#'}
                          onClick={onNavigate}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <ChildIcon className="h-4 w-4" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const Icon = item.icon;
          const active = item.href ? isLinkActive(pathname, item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href ?? '#'}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className={cn('border-t py-3', collapsed ? 'px-2' : 'px-3')}>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </div>
  );
}
