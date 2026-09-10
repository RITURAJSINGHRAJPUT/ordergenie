import bcrypt from 'bcryptjs';
import { ApiType, SyncType, RoleName } from '@prisma/client';
import { prisma } from '../../config/db';
import { encrypt, decrypt } from '../../utils/encryption';
import { AppError } from '../../utils/apiResponse';
import { rescheduleJob } from '../../cron';

function mask(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

// --- Petpooja API Config ---

export async function listApiConfigs() {
  const rows = await prisma.petpoojaApiConfig.findMany({ orderBy: { apiType: 'asc' } });
  return rows.map((r) => ({
    id: r.id,
    apiType: r.apiType,
    isConfigured: r.isConfigured,
    appKeyMasked: mask(r.appKeyEncrypted ? decrypt(r.appKeyEncrypted) : null),
    accessTokenMasked: mask(r.accessTokenEncrypted ? decrypt(r.accessTokenEncrypted) : null),
    hasCookie: Boolean(r.cookieEncrypted),
    lastVerifiedAt: r.lastVerifiedAt,
    notes: r.notes,
    updatedAt: r.updatedAt,
  }));
}

export interface UpdateApiConfigInput {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  cookie?: string;
  notes?: string;
}

export async function updateApiConfig(apiType: ApiType, input: UpdateApiConfigInput) {
  const existing = await prisma.petpoojaApiConfig.findUnique({ where: { apiType } });
  if (!existing) throw new AppError('Unknown API type', 404);

  const data: Record<string, unknown> = { notes: input.notes };
  if (input.appKey) data.appKeyEncrypted = encrypt(input.appKey);
  if (input.appSecret) data.appSecretEncrypted = encrypt(input.appSecret);
  if (input.accessToken) data.accessTokenEncrypted = encrypt(input.accessToken);
  if (input.cookie) data.cookieEncrypted = encrypt(input.cookie);

  const hasKey = Boolean(input.appKey ?? existing.appKeyEncrypted);
  const hasSecret = Boolean(input.appSecret ?? existing.appSecretEncrypted);
  const hasToken = Boolean(input.accessToken ?? existing.accessTokenEncrypted);
  data.isConfigured = hasKey && hasSecret && hasToken;

  return prisma.petpoojaApiConfig.update({ where: { apiType }, data });
}

// --- Sync Schedule ---

export async function listSyncSchedules() {
  return prisma.syncSchedule.findMany({ orderBy: { syncType: 'asc' } });
}

export async function updateSyncSchedule(syncType: SyncType, input: { cronExpression?: string; isEnabled?: boolean }) {
  const updated = await prisma.syncSchedule.update({
    where: { syncType },
    data: { ...(input.cronExpression ? { cronExpression: input.cronExpression } : {}), ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}) },
  });
  await rescheduleJob(syncType);
  return updated;
}

// --- Users ---

export async function listUsers() {
  return prisma.user.findMany({
    include: { role: true, outlet: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// HEAD_CHEF/OUTLET_MANAGER accounts are meaningless without an assigned outlet —
// scopeToOutlet (rbac.middleware.ts) 403s nearly every data route for these roles
// when outletId is null, and outletRestrictionFor (authz.ts) would otherwise leave
// detail lookups silently unscoped. Neither the create nor update payload previously
// enforced this, which is how a broken no-outlet HEAD_CHEF account reached production.
async function assertOutletRequirementSatisfied(
  roleId: string,
  outletId: string | null | undefined,
  brand: string | null | undefined
): Promise<string | null> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError('Role not found', 404);

  const requiresOutlet = role.name === RoleName.HEAD_CHEF || role.name === RoleName.OUTLET_MANAGER;
  if (requiresOutlet && !outletId) {
    throw new AppError('This role requires an assigned outlet', 400);
  }

  if (outletId) {
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet || !outlet.isActive) {
      throw new AppError('Outlet not found or inactive', 400);
    }
    // Derived, never trusted from the payload: a stored brand that disagreed with the
    // assigned outlet would make the two scopes contradict each other.
    return outlet.brand;
  }

  if (brand) {
    const exists = await prisma.outlet.findFirst({ where: { brand }, select: { id: true } });
    if (!exists) throw new AppError('Unknown brand', 400);
    return brand;
  }

  // No outlet and no brand — unrestricted, i.e. "All brands / All outlets".
  return null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roleId: string;
  outletId?: string;
  brand?: string | null;
  pageGrants?: string[];
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('A user with this email already exists', 409);

  const brand = await assertOutletRequirementSatisfied(input.roleId, input.outletId, input.brand);

  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      roleId: input.roleId,
      outletId: input.outletId,
      brand,
      pageGrants: input.pageGrants ?? [],
    },
  });
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  roleId?: string;
  outletId?: string | null;
  brand?: string | null;
  pageGrants?: string[];
  isActive?: boolean;
  password?: string;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== id) throw new AppError('A user with this email already exists', 409);
    data.email = input.email;
  }
  if (input.roleId !== undefined) data.roleId = input.roleId;
  if (input.outletId !== undefined) data.outletId = input.outletId;
  if (input.pageGrants !== undefined) data.pageGrants = input.pageGrants;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);

  // Only re-validate when role or outlet are actually changing — checks the
  // resulting (post-update) combination, not just whichever field was touched,
  // so e.g. switching role to HEAD_CHEF on a user with no outlet still gets caught.
  if (input.roleId !== undefined || input.outletId !== undefined || input.brand !== undefined) {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) throw new AppError('User not found', 404);
    const effectiveRoleId = input.roleId ?? current.roleId;
    const effectiveOutletId = input.outletId !== undefined ? input.outletId : current.outletId;
    const effectiveBrand = input.brand !== undefined ? input.brand : current.brand;
    data.brand = await assertOutletRequirementSatisfied(effectiveRoleId, effectiveOutletId, effectiveBrand);
  }

  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string, requestingUserId: string) {
  if (id === requestingUserId) throw new AppError('You cannot delete your own account', 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found', 404);

  await prisma.$transaction([
    prisma.notificationSetting.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
}

// --- Roles ---

export async function listRoles() {
  return prisma.role.findMany({ orderBy: { name: 'asc' } });
}

export async function updateRoleDescription(id: string, description: string) {
  return prisma.role.update({ where: { id }, data: { description } });
}

// --- Notification Settings ---

export async function getNotificationSettings(userId: string) {
  const existing = await prisma.notificationSetting.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.notificationSetting.create({ data: { userId } });
}

export async function updateNotificationSettings(
  userId: string,
  input: { lowStockAlerts?: boolean; syncFailureAlerts?: boolean; dailySummaryEmail?: boolean }
) {
  return prisma.notificationSetting.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
}
