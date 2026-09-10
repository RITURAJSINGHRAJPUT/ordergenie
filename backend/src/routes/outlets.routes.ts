import { Router } from 'express';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToBrand, scopeToOutlet } from '../middleware/rbac.middleware';
import { RoleName } from '@prisma/client';
import { listOutletsHandler, getOutletsOverviewHandler, getOutletComparisonHandler } from '../controllers/outlets.controller';

const router = Router();

router.use(verifyJwt);

router.get('/overview', requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.VIEWER), getOutletsOverviewHandler);
router.get('/comparison', requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.VIEWER), getOutletComparisonHandler);
router.get('/', scopeToOutlet, scopeToBrand, listOutletsHandler);

export default router;
