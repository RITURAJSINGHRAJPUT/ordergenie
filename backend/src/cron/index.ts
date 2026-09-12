import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { SyncType } from '@prisma/client';
import { prisma } from '../config/db';
import { CRON_TIMEZONE, BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR, OFF_HOURS_SYNC_INTERVAL_MINUTES } from '../config/constants';
import { logger } from '../utils/logger';

type JobHandler = () => Promise<void>;

// Only these run every 5 minutes; the rest (HISTORICAL daily, INVENTORY/TRANSFER not enabled
// by default) don't need off-hours throttling.
const OFF_HOURS_THROTTLED_TYPES = new Set<SyncType>([SyncType.SALES, SyncType.PURCHASE]);

function istHourMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CRON_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')!.value),
    minute: Number(parts.find((p) => p.type === 'minute')!.value),
  };
}

function shouldSkipOffHoursTick(syncType: SyncType, now: Date): boolean {
  if (!OFF_HOURS_THROTTLED_TYPES.has(syncType)) return false;
  const { hour, minute } = istHourMinute(now);
  const inBusinessHours = hour >= BUSINESS_HOURS_START_HOUR && hour < BUSINESS_HOURS_END_HOUR;
  if (inBusinessHours) return false;
  return minute % OFF_HOURS_SYNC_INTERVAL_MINUTES !== 0;
}

const jobRegistry = new Map<SyncType, ScheduledTask>();

// Replaced with real sync service calls once the Petpooja sync services exist (see src/services/sync/*).
const jobHandlers: Record<SyncType, JobHandler> = {
  SALES: async () => logger.info('[cron] SALES sync tick (handler not yet wired)'),
  INVENTORY: async () => logger.info('[cron] INVENTORY sync tick (handler not yet wired)'),
  PURCHASE: async () => logger.info('[cron] PURCHASE sync tick (handler not yet wired)'),
  HISTORICAL: async () => logger.info('[cron] HISTORICAL sync tick (handler not yet wired)'),
  TRANSFER: async () => logger.info('[cron] TRANSFER sync tick (handler not yet wired)'),
};

export function setJobHandler(syncType: SyncType, handler: JobHandler) {
  jobHandlers[syncType] = handler;
}

async function registerJob(syncType: SyncType) {
  const schedule = await prisma.syncSchedule.findUnique({ where: { syncType } });
  if (!schedule || !schedule.isEnabled) return;

  const task = cron.schedule(
    schedule.cronExpression,
    async () => {
      if (shouldSkipOffHoursTick(syncType, new Date())) return;
      try {
        await jobHandlers[syncType]();
        await prisma.syncSchedule.update({ where: { syncType }, data: { lastRunAt: new Date() } });
      } catch (err) {
        logger.error(`[cron] ${syncType} job failed`, { err });
      }
    },
    { timezone: CRON_TIMEZONE }
  );

  jobRegistry.set(syncType, task);
  logger.info(`[cron] Registered ${syncType} job: ${schedule.cronExpression}`);
}

export async function registerAllJobs() {
  for (const syncType of Object.values(SyncType)) {
    await registerJob(syncType);
  }
}

export async function rescheduleJob(syncType: SyncType) {
  const existing = jobRegistry.get(syncType);
  if (existing) {
    existing.stop();
    jobRegistry.delete(syncType);
  }
  await registerJob(syncType);
}
