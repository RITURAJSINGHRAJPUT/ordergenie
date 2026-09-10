import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToBrand, scopeToOutlet } from '../middleware/rbac.middleware';
import { listReconciliationHandler, upsertReconciliationEntryHandler } from '../controllers/reconciliation.controller';

const router = Router();

router.use(verifyJwt, scopeToOutlet, scopeToBrand);

// Every authenticated role can view (open router-level, no requireRole) except entries can
// only be written by everyone but VIEWER — this is the one write-only gate for this router.
const canWrite = requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.HEAD_CHEF);

router.get('/', listReconciliationHandler);
router.post('/entries', canWrite, upsertReconciliationEntryHandler);

export default router;
