import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { AppError } from '../utils/apiResponse';
import {
  listApiConfigsHandler,
  updateApiConfigHandler,
  listSyncSchedulesHandler,
  updateSyncScheduleHandler,
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listRolesHandler,
  updateRoleHandler,
  getNotificationSettingsHandler,
  updateNotificationSettingsHandler,
} from '../controllers/settings.controller';

const router = Router();

router.use(verifyJwt);

// Self-service, any authenticated user — except VIEWER, which has no notifications
// visibility at all per its role definition. There's no allowlist to omit VIEWER
// from here (this is normally open to everyone), so it's an explicit block instead.
function blockViewer(req: Request, _res: Response, next: NextFunction) {
  if (req.user!.role === RoleName.VIEWER) {
    throw new AppError('You do not have permission to perform this action', 403);
  }
  next();
}

router.get('/notifications', blockViewer, getNotificationSettingsHandler);
router.put('/notifications', blockViewer, updateNotificationSettingsHandler);

// Settings is SUPER_ADMIN territory: ADMIN was deliberately dropped here, so managing
// users/roles/config/sync is the one thing an admin can't do.
const superAdminOnly = requireRole(RoleName.SUPER_ADMIN);

// VIEWER keeps its existing read-only Petpooja API tab.
router.get('/api-config', requireRole(RoleName.SUPER_ADMIN, RoleName.VIEWER), listApiConfigsHandler);
router.put('/api-config/:apiType', superAdminOnly, updateApiConfigHandler);

router.get('/sync-schedule', superAdminOnly, listSyncSchedulesHandler);
router.put('/sync-schedule/:syncType', superAdminOnly, updateSyncScheduleHandler);

router.get('/users', superAdminOnly, listUsersHandler);
router.post('/users', superAdminOnly, createUserHandler);
router.put('/users/:id', superAdminOnly, updateUserHandler);
router.delete('/users/:id', superAdminOnly, deleteUserHandler);

router.get('/roles', superAdminOnly, listRolesHandler);
router.put('/roles/:id', superAdminOnly, updateRoleHandler);

export default router;
