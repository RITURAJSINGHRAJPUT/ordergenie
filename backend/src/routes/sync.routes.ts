import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { triggerManualSyncHandler, listSyncLogsHandler } from '../controllers/sync.controller';

const router = Router();

router.use(verifyJwt, requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT));

router.post('/manual', triggerManualSyncHandler);
router.get('/logs', listSyncLogsHandler);

export default router;
