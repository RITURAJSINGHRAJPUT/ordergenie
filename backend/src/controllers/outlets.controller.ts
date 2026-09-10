import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { listOutlets, getOutletsOverview, getOutletComparison } from '../services/outlet/outlets.service';

export const listOutletsHandler = asyncHandler(async (req: Request, res: Response) => {
  // scopeToOutlet (mounted on this router) forces outletId for OUTLET_MANAGER.
  const outletId = typeof req.query.outletId === 'string' ? req.query.outletId : undefined;
  // scopeToBrand forces req.query.brand for brand-scoped users, which is what restricts the
  // sidebar too — useVisibleNav derives the visible brands from this endpoint's response.
  const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
  const outlets = await listOutlets({ outletId, brand });

  // Petpooja sync codes are integration config, not something non-admins need to see.
  const isAdmin = req.user?.role === 'ADMIN';
  const sanitized = isAdmin
    ? outlets
    : outlets.map(({ salesSyncCode: _salesSyncCode, inventorySyncCode: _inventorySyncCode, ...rest }) => rest);

  return ok(res, sanitized);
});

export const getOutletsOverviewHandler = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await getOutletsOverview());
});

export const getOutletComparisonHandler = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await getOutletComparison(req.query as Record<string, string>));
});
