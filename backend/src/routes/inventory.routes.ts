import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToBrand, scopeToOutlet } from '../middleware/rbac.middleware';
import {
  listInventoryHandler,
  getInventoryHandler,
  listInventoryStoresHandler,
  listInventoryCategoriesHandler,
} from '../controllers/inventory.controller';

const router = Router();

router.use(verifyJwt, requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.VIEWER), scopeToOutlet, scopeToBrand);

router.get('/stores', listInventoryStoresHandler);
router.get('/categories', listInventoryCategoriesHandler);
router.get('/:id', getInventoryHandler);
router.get('/', listInventoryHandler);

export default router;
