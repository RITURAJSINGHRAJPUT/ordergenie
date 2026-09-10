import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { verifyJwt } from '../middleware/auth.middleware';
import { requirePageGrant, requireRole, SALES_FORECAST_GRANT, scopeToBrand, scopeToOutlet } from '../middleware/rbac.middleware';
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

// The Sales Forecast page is grantable: SUPER_ADMIN always, plus any user explicitly given it.
// A plain ADMIN has no access unless granted.
const canManageForecast = requirePageGrant(SALES_FORECAST_GRANT);

// Import/management endpoints — tighter than the read-only list below.
// Registered before the shared verifyJwt+scopeToOutlet, scopeToBrand block since they don't need
// outlet-scoping (a workbook upload spans every outlet in one go).
router.post('/import', canManageForecast, uploadPredictionWorkbookMiddleware, importPredictionWorkbookHandler);
router.get('/summary', canManageForecast, getPredictionSummaryHandler);
router.get('/import-logs', canManageForecast, listPredictionImportLogsHandler);
router.delete('/import-logs/:id', canManageForecast, deletePredictionImportLogHandler);

router.use(requireRole(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGEMENT, RoleName.OUTLET_MANAGER, RoleName.VIEWER), scopeToOutlet, scopeToBrand);

router.get('/', listPredictedSalesHandler);

export default router;
