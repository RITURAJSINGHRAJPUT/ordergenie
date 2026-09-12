import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToBrand, scopeToOutlet } from '../middleware/rbac.middleware';
import {
  listClassAItemsHandler,
  addClassAItemHandler,
  removeClassAItemHandler,
  setPurchaseAliasesHandler,
  suggestPurchaseAliasesHandler,
  getClassAItemsSummaryHandler,
} from '../controllers/classAItems.controller';

const router = Router();

const canWrite = requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER);

router.use(verifyJwt, requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.VIEWER), scopeToOutlet, scopeToBrand);

// /summary must be registered before /:id so "summary" isn't captured as an id param.
router.get('/summary', getClassAItemsSummaryHandler);
router.get('/', listClassAItemsHandler);
router.post('/', canWrite, addClassAItemHandler);
// Registered before '/:id' so "purchase-aliases" isn't captured as an id param.
router.get('/purchase-aliases/suggestions', suggestPurchaseAliasesHandler);
router.put('/purchase-aliases', canWrite, setPurchaseAliasesHandler);
router.delete('/:id', canWrite, removeClassAItemHandler);

export default router;
