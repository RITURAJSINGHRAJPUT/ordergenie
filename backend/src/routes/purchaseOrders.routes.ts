import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToOutlet } from '../middleware/rbac.middleware';
import {
  listPurchaseOrdersHandler,
  listPurchaseOrderItemsByDayHandler,
  getPurchaseOrderHandler,
  getPurchaseOrderPdfHandler,
} from '../controllers/purchaseOrders.controller';

const router = Router();

router.use(verifyJwt, requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.VIEWER), scopeToOutlet);

// Must come before '/:id' — Express matches route registration order, and '/:id' would
// otherwise swallow '/by-item' as an id lookup.
router.get('/by-item', listPurchaseOrderItemsByDayHandler);
router.get('/:id/pdf', getPurchaseOrderPdfHandler);
router.get('/:id', getPurchaseOrderHandler);
router.get('/', listPurchaseOrdersHandler);

export default router;
