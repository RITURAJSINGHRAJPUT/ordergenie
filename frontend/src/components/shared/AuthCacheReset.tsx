'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useFilterStore } from '@/store/filterStore';

/**
 * Wipes the query cache whenever the signed-in account changes.
 *
 * The QueryClient is created once per app mount and logout/login are client-side
 * navigations (no page reload), so without this the previous user's cached data —
 * outlets, dashboard, sales, everything — is handed straight to whoever signs in
 * next in the same tab. Doing it here, off the auth store, rather than at each
 * logout/login call site means a future third call site can't forget it.
 *
 * The first `undefined -> id` transition (fresh tab, store rehydration) is skipped
 * on purpose: there's nothing to leak yet, and clearing would cancel the first
 * page's in-flight requests.
 */
export function AuthCacheReset() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const previousUserId = useRef(userId);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;

    if (previous === undefined || previous === userId) return;

    queryClient.clear();
    useFilterStore.getState().reset();
  }, [userId, queryClient]);

  return null;
}
