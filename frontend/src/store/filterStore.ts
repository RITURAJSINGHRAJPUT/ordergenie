import { create } from 'zustand';

export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

interface FilterState {
  outletId: string | 'all';
  range: DateRangePreset;
  customFrom: string | null;
  customTo: string | null;
  setOutletId: (outletId: string | 'all') => void;
  setRange: (range: DateRangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  /** Back to defaults — used when the signed-in user changes (see AuthCacheReset). */
  reset: () => void;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The Header's date filter is always two explicit Start/End date inputs (no presets
// UI), so the store defaults to an explicit custom range from the start, rather than
// an implicit preset the UI wouldn't have a way to display. Defaults to the last 7
// days (matching HISTORICAL_SYNC_WINDOW_DAYS on the backend) rather than today-only —
// a today-only default made data synced as recently as yesterday invisible without
// the user manually widening the filter, which reads as "not fetched" when it isn't.
function defaults() {
  return {
    outletId: 'all' as const,
    range: 'custom' as const,
    customFrom: daysAgoIso(6),
    customTo: todayIso(),
  };
}

export const useFilterStore = create<FilterState>((set) => ({
  ...defaults(),
  setOutletId: (outletId) => set({ outletId }),
  setRange: (range) => set({ range }),
  setCustomRange: (customFrom, customTo) => set({ customFrom, customTo, range: 'custom' }),
  reset: () => set(defaults()),
}));
