import { useCallback, useSyncExternalStore } from 'react';

/** Live result of a CSS media query. Prefer Tailwind breakpoints for layout; this is for
 * props that CSS can't reach (chart dimensions, calendar month count). The server render
 * and first hydration pass report `false`, i.e. the desktop layout. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Below Tailwind's `md` breakpoint — the same line the card/table switch uses. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
