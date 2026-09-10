import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiType, SyncType } from '@prisma/client';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import * as settingsService from '../services/settings/settingsConfig.service';

// --- API Config ---

export const listApiConfigsHandler = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await settingsService.listApiConfigs());
});

const updateApiConfigSchema = z.object({
  appKey: z.string().optional(),
  appSecret: z.string().optional(),
  accessToken: z.string().optional(),
  cookie: z.string().optional(),
  notes: z.string().optional(),
});

export const updateApiConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const apiType = req.params.apiType.toUpperCase() as ApiType;
  const input = updateApiConfigSchema.parse(req.body);
  return ok(res, await settingsService.updateApiConfig(apiType, input));
});

// --- Sync Schedule ---

export const listSyncSchedulesHandler = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await settingsService.listSyncSchedules());
});

const updateSyncScheduleSchema = z.object({
  cronExpression: z.string().optional(),
  isEnabled: z.boolean().optional(),
});

export const updateSyncScheduleHandler = asyncHandler(async (req: Request, res: Response) => {
  const syncType = req.params.syncType.toUpperCase() as SyncType;
  const input = updateSyncScheduleSchema.parse(req.body);
  return ok(res, await settingsService.updateSyncSchedule(syncType, input));
});

// --- Users ---

export const listUsersHandler = asyncHandler(async (_req: Request, res: Response) => {
  const users = await settingsService.listUsers();
  return ok(
    res,
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role.name,
      roleId: u.roleId,
      outletId: u.outletId,
      outletName: u.outlet?.name ?? null,
      brand: u.brand,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
    }))
  );
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  roleId: z.string(),
  outletId: z.string().optional(),
  brand: z.string().nullable().optional(),
});

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await settingsService.createUser(input);
  return ok(res, { id: user.id, email: user.email });
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  roleId: z.string().optional(),
  outletId: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = await settingsService.updateUser(req.params.id, input);
  return ok(res, { id: user.id, email: user.email });
});

export const deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
  await settingsService.deleteUser(req.params.id, req.user!.id);
  return ok(res, { removed: true });
});

// --- Roles ---

export const listRolesHandler = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await settingsService.listRoles());
});

const updateRoleSchema = z.object({ description: z.string() });

export const updateRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const { description } = updateRoleSchema.parse(req.body);
  return ok(res, await settingsService.updateRoleDescription(req.params.id, description));
});

// --- Notification Settings ---

export const getNotificationSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await settingsService.getNotificationSettings(req.user!.id));
});

const updateNotificationSchema = z.object({
  lowStockAlerts: z.boolean().optional(),
  syncFailureAlerts: z.boolean().optional(),
  dailySummaryEmail: z.boolean().optional(),
});

export const updateNotificationSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateNotificationSchema.parse(req.body);
  return ok(res, await settingsService.updateNotificationSettings(req.user!.id, input));
});
