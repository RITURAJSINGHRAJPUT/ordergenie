'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useMyMissingClosings } from '@/hooks/useAlerts';
import { useAuthStore } from '@/store/authStore';
import { useFilterStore } from '@/store/filterStore';
import { formatDate } from '@/lib/format';

/** On screen just long enough to register, then out of the way. */
const VISIBLE_MS = 5000;
const SEEN_KEY = 'closing-reminder-seen-for';

/** sessionStorage can throw in private mode, and a reminder is never worth breaking a page for. */
function readSeen(): string | null {
  try {
    return sessionStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(userId: string): void {
  try {
    sessionStorage.setItem(SEEN_KEY, userId);
  } catch {
    /* ignore — the reminder simply shows again next load */
  }
}

/**
 * Tells outlet staff, right after they sign in, that a day's Actual Closing is still unfilled.
 *
 * Once per login: the key holds the user id for the session, so a reload stays quiet while the
 * next sign-in (a fresh session) shows it again.
 */
export function ClosingReminderOverlay() {
  const user = useAuthStore((s) => s.user);
  const { data } = useMyMissingClosings();
  const setOutletId = useFilterStore((s) => s.setOutletId);
  const setCustomRange = useFilterStore((s) => s.setCustomRange);
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const rows = data ?? [];
  const userId = user?.id;

  useEffect(() => {
    if (!userId || rows.length === 0) return;
    if (readSeen() === userId) return;

    markSeen(userId);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [userId, rows.length]);

  useEffect(() => {
    if (!visible) return;
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setVisible(false);
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [visible]);

  if (!visible || rows.length === 0) return null;

  // Oldest first here: the day furthest back is the one most likely to be forgotten, and it's
  // where the carry-forward chain breaks first.
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const oldest = sorted[0];

  function openReconciliation() {
    setOutletId(oldest.outletId);
    setCustomRange(oldest.date, oldest.date);
    setVisible(false);
    router.push(`/${oldest.brand.toLowerCase()}/reconciliation`);
  }

  // my-auto (not items-center) centers the card but lets it start at the top and scroll when a
  // long list outgrows a landscape phone; the max() padding keeps it clear of the notch.
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/50 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
      onClick={() => setVisible(false)}
      role="presentation"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openReconciliation();
        }}
        className="my-auto w-full max-w-sm rounded-lg bg-background p-5 text-left shadow-lg ring-1 ring-destructive/30"
      >
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">Closing not filled in</span>
        </div>

        <p className="mt-3 text-sm font-medium">{oldest.outletName}</p>
        <div className="mt-1 space-y-0.5">
          {sorted.map((row) => (
            <p key={row.date} className="text-sm text-muted-foreground">
              {formatDate(row.date)} — {row.filled} of {row.expected} items entered
            </p>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">Tap to open Reconciliation</p>
      </button>
    </div>
  );
}
