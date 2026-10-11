'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sidebar } from './Sidebar';
import { AlertsBell } from './AlertsBell';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '@/store/authStore';

export function Header() {
  const { user } = useAuthStore();
  const [navOpen, setNavOpen] = useState(false);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="flex min-h-14 items-center justify-between gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top)] sm:min-h-16 sm:gap-3 sm:px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 max-w-[85vw] p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {/* The collapse toggle is a desktop affordance and would sit under the sheet's close button. */}
            <Sidebar onNavigate={() => setNavOpen(false)} showCollapseToggle={false} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-3">
        {(user?.role === 'OUTLET_MANAGER' || user?.role === 'HEAD_CHEF') && (
          <span className="max-w-[40vw] truncate text-sm text-muted-foreground sm:max-w-none">{user.outletName}</span>
        )}

        <ThemeToggle />

        {/* Renders nothing for roles other than SUPER_ADMIN. */}
        <AlertsBell />

        <div className="flex shrink-0 items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-sm leading-tight sm:block">
            <div className="font-medium">{user?.name}</div>
            <div className="text-muted-foreground">{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
