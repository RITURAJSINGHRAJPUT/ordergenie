export const DEFAULT_CRON_EXPRESSIONS: Record<'SALES' | 'PURCHASE' | 'HISTORICAL', string> = {
  SALES: '*/5 * * * *',
  PURCHASE: '*/5 * * * *',
  HISTORICAL: '0 2 * * *',
};

export const CRON_TIMEZONE = 'Asia/Kolkata';

// SALES/PURCHASE sync every 5 minutes so data stays fresh during service hours, but almost
// every tick outside them finds nothing new — this throttles those two jobs to roughly once
// every OFF_HOURS_SYNC_INTERVAL_MINUTES outside [BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR)
// IST, cutting most of the wasted overnight API calls/compute without changing the admin-editable
// cron schedule itself or business-hours freshness. See cron/index.ts.
export const BUSINESS_HOURS_START_HOUR = 9;
export const BUSINESS_HOURS_END_HOUR = 23;
export const OFF_HOURS_SYNC_INTERVAL_MINUTES = 30;

export const LOW_STOCK_DEFAULT_THRESHOLD = 10;
