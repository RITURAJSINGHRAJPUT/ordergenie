import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { poLookupHandler, poLookupPdfHandler } from '../controllers/poLookup.controller';

const router = Router();

// Every signed-in role, and deliberately without scopeToOutlet/scopeToBrand: a city total is the
// whole point here, so an outlet's own staff see their neighbours' quantities in the same table.
router.use(
  verifyJwt,
  requireRole(
    RoleName.SUPER_ADMIN,
    RoleName.ADMIN,
    RoleName.MANAGEMENT,
    RoleName.OUTLET_MANAGER,
    RoleName.HEAD_CHEF,
    RoleName.VIEWER
  )
);

router.get('/pdf', poLookupPdfHandler);
router.get('/', poLookupHandler);

export default router;
