import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requireRole, scopeToOutlet } from '../middleware/rbac.middleware';
import { listPredictedSalesHandler } from '../controllers/predictedSales.controller';
import {
  uploadPredictionWorkbookMiddleware,
  importPredictionWorkbookHandler,
  getPredictionSummaryHandler,
  listPredictionImportLogsHandler,
  deletePredictionImportLogHandler,
} from '../controllers/predictedSalesImport.controller';

const router = Router();

router.use(verifyJwt);

const adminOnly = requireRole(RoleName.ADMIN);

// Import/management endpoints — admin-only, tighter than the read-only list below.
// Registered before the shared verifyJwt+scopeToOutlet block since they don't need
// outlet-scoping (a workbook upload spans every outlet in one go).
router.post('/import', adminOnly, uploadPredictionWorkbookMiddleware, importPredictionWorkbookHandler);
router.get('/summary', adminOnly, getPredictionSummaryHandler);
router.get('/import-logs', adminOnly, listPredictionImportLogsHandler);
router.delete('/import-logs/:id', adminOnly, deletePredictionImportLogHandler);

router.use(requireRole(RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.VIEWER), scopeToOutlet);

router.get('/', listPredictedSalesHandler);

export default router;
