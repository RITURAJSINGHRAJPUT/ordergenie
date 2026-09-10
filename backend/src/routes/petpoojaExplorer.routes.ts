import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { explorerFetchHandler } from '../controllers/petpoojaExplorer.controller';

const router = Router();

router.use(verifyJwt, requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.VIEWER));

router.post('/fetch', explorerFetchHandler);

export default router;
