import { Router } from 'express';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { RoleName } from '@prisma/client';
import { getReportHandler } from '../controllers/reports.controller';

const router = Router();

router.get('/', verifyJwt, requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.VIEWER), getReportHandler);

export default router;
