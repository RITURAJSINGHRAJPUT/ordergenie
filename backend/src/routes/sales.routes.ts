import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToBrand, scopeToOutlet } from '../middleware/rbac.middleware';
import {
  listSalesHandler,
  getSaleHandler,
  listItemSalesHandler,
  getItemDetailHandler,
  listItemCategoriesHandler,
} from '../controllers/sales.controller';

const router = Router();

router.use(verifyJwt, requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.VIEWER), scopeToOutlet, scopeToBrand);

// NOTE: /items routes must be registered before /:id so "items" isn't captured as an id param,
// and /items/categories before /items/:itemName for the same reason.
router.get('/items', listItemSalesHandler);
router.get('/items/categories', listItemCategoriesHandler);
router.get('/items/:itemName', getItemDetailHandler);
router.get('/:id', getSaleHandler);
router.get('/', listSalesHandler);

export default router;
