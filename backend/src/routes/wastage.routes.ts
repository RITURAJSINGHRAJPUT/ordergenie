import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToOutlet } from '../middleware/rbac.middleware';
import { listWastageHandler, createWastageHandler, deleteWastageHandler } from '../controllers/wastage.controller';

const router = Router();

// HEAD_CHEF reports wastage from the kitchen but can't remove records after the fact,
// so create and delete are separate gates rather than one shared write gate.
const canCreate = requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.HEAD_CHEF);
const canDelete = requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER);

router.use(
  verifyJwt,
  requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.HEAD_CHEF, RoleName.VIEWER),
  scopeToOutlet
);

router.get('/', listWastageHandler);
router.post('/', canCreate, createWastageHandler);
router.delete('/:id', canDelete, deleteWastageHandler);

export default router;
