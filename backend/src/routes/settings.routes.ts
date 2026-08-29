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

// Admin-only
const adminOnly = requireRole(RoleName.ADMIN);

router.get('/api-config', requireRole(RoleName.ADMIN, RoleName.VIEWER), listApiConfigsHandler);
router.put('/api-config/:apiType', adminOnly, updateApiConfigHandler);

router.get('/sync-schedule', adminOnly, listSyncSchedulesHandler);
router.put('/sync-schedule/:syncType', adminOnly, updateSyncScheduleHandler);

router.get('/users', adminOnly, listUsersHandler);
router.post('/users', adminOnly, createUserHandler);
router.put('/users/:id', adminOnly, updateUserHandler);
router.delete('/users/:id', adminOnly, deleteUserHandler);

router.get('/roles', adminOnly, listRolesHandler);
router.put('/roles/:id', adminOnly, updateRoleHandler);

export default router;
